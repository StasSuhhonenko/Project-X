/** Atomic ordinary delivery/surface lifecycle. Every refusal retains the exact
 * input world; policy errors throw before any host publication. No clock ticks
 * or random draws occur while quoting acceptance. */
import { z } from 'zod';
import type { GameModule } from '../../content/game-module';
import { ContractAcceptanceResultSchema, SurfaceMissionResultSchema } from '../contracts/mission-rules';
import { totalCargoTons } from '../model/cargo-quantities';
import { NoticeMessageSchema } from '../model/entity-components';
import { applyStandingDelta } from '../model/lifecycle-state';
import {
  ContractNegotiationContextSchema,
  ContractNegotiationResultSchema,
  ContractOfferRefSchema,
  type ContractOffer,
  type ContractOfferRef,
} from '../model/mission-state';
import { parseWorldState, selectPlayerEntity, type WorldState } from '../model/world-state';
import { resolveProgression } from './progression';

/** Live identity/availability check shared by operations and display quotes. */
export function resolveContractOffer(world: WorldState, input: ContractOfferRef): ContractOffer | null {
  const parsed = ContractOfferRefSchema.safeParse(input),
    player = selectPlayerEntity(world),
    state = world.missions;
  if (!parsed.success || !state || world.status !== 'active' || player.condition.repairing) return null;
  const ref = parsed.data;
  if (
    ref.visitEntityId !== state.visitEntityId ||
    ref.seed !== state.seed ||
    ref.systemId !== state.systemId ||
    ref.systemId !== player.location.systemId
  )
    return null;
  if (ref.kind === 'planet') return state.planetOffer;
  if (!world.entities.some(entity => entity.kind === 'station' && entity.stationId === ref.stationId)) return null;
  return state.stationOffers[ref.stationId!] ?? null;
}

/** Pure display/commit quote; module refusals retain their text. Null denotes
 * stale identity, exhausted positions or a policy allocation outside bounds. */
export function quoteContractAcceptance(world: WorldState, game: GameModule, ref: ContractOfferRef) {
  const offer = resolveContractOffer(world, ref),
    policy = game.rules.missions,
    player = selectPlayerEntity(world);
  const vessel = game.catalog.getShipDefinition(player.definitionId);
  if (!offer || !policy || !vessel || !game.definition.commerce) return null;
  const freeCapacity = Math.max(0, Math.floor(vessel.cargoCapacity - totalCargoTons(player.inventory.cargo)));
  const result = ContractAcceptanceResultSchema.parse(
    policy.quoteContractAcceptance(Object.freeze({ offer, kind: ref.kind, freeCapacity }))
  );
  if ('refusal' in result) return result;
  // Policy must clamp exactly, never award a zero-ton contract or invent cargo.
  if (freeCapacity === 0 || result.tons !== Math.min(offer.tons, freeCapacity)) return null;
  if (
    !Array.from({ length: game.definition.commerce.slotCapacity }, (_, slot) => slot).some(
      slot => !player.inventory.cargo.some(pod => pod.slot === slot)
    )
  )
    return null;
  return result;
}

function replaceOffer(world: WorldState, ref: ContractOfferRef, offer: ContractOffer | null): WorldState {
  const state = world.missions!;
  const negotiations = Object.fromEntries(Object.entries(state.negotiations).filter(([id]) => id !== ref.stationId));
  return parseWorldState({
    ...world,
    missions: {
      ...state,
      negotiations,
      planetOffer: ref.kind === 'planet' ? offer : state.planetOffer,
      stationOffers: ref.kind === 'station' ? { ...state.stationOffers, [ref.stationId!]: offer } : state.stationOffers,
    },
  });
}

/** First empty position, bounded whole tons and fixed safe payment. */
export function acceptContract(world: WorldState, game: GameModule, ref: ContractOfferRef): WorldState {
  const quote = quoteContractAcceptance(world, game, ref),
    offer = resolveContractOffer(world, ref);
  if (!quote || 'refusal' in quote || !offer) return world;
  const player = selectPlayerEntity(world);
  const slot = Array.from({ length: game.definition.commerce!.slotCapacity }, (_, slot) => slot).find(
    slot => !player.inventory.cargo.some(pod => pod.slot === slot)
  )!;
  const next = replaceOffer(world, ref, null);
  const loaded = parseWorldState({
    ...next,
    entities: next.entities.map(entity =>
      entity.id !== player.id
        ? entity
        : {
            ...player,
            inventory: {
              ...player.inventory,
              cargo: [
                ...player.inventory.cargo,
                {
                  slot,
                  goodsId: offer.goodsId,
                  tons: quote.tons,
                  contract: { destinationSystemId: offer.destinationSystemId, payout: quote.payout },
                },
              ].sort((a, b) => a.slot - b.slot),
            },
          }
    ),
  });
  return resolveProgression(loaded, game.rules, game.definition.progression, {
    kind: 'contract-accept',
    offerKind: ref.kind,
  });
}

/** Once per station offer. C7 settles first on its own stream, then negotiation
 * draws from world.randomState (the active visit stream), never progression. */
export function negotiateContract(world: WorldState, game: GameModule, ref: ContractOfferRef): WorldState {
  const offer = resolveContractOffer(world, ref),
    policy = game.rules.missions;
  if (!offer || !policy || ref.kind !== 'station' || offer.negotiated) return world;
  const progressed = resolveProgression(world, game.rules, game.definition.progression, { kind: 'contract-negotiate' });
  const context = ContractNegotiationContextSchema.parse({
    offer,
    progression: progressed.progression,
    randomState: progressed.randomState,
  });
  const result = ContractNegotiationResultSchema.parse(policy.resolveContractNegotiation(context));
  const next = replaceOffer(
    progressed,
    ref,
    result.success ? { ...offer, negotiated: true, basePayPerTon: result.basePayPerTon } : null
  );
  return parseWorldState({
    ...next,
    randomState: result.randomState,
    missions: {
      ...next.missions!,
      negotiations: result.success
        ? { ...next.missions!.negotiations, [ref.stationId!]: context }
        : next.missions!.negotiations,
    },
  });
}

/** One transport delivers the lowest matching slot, including the last slot,
 * regardless of population. Otherwise a populated surface consumes its pending
 * index before policy evaluation. Repeated transports use index zero. */
export function transportToSurface(world: WorldState, game: GameModule): WorldState {
  const player = selectPlayerEntity(world),
    policy = game.rules.missions;
  if (!policy || !world.missions || world.status !== 'active' || player.condition.repairing) return world;
  if (!Number.isSafeInteger((player.feedback.notice?.sequence ?? 0) + 1)) return world;
  const system = game.definition.systems.find(system => system.id === player.location.systemId),
    planet = world.entities.find(entity => entity.kind === 'planet');
  if (!system || !planet) return world;
  const context = Object.freeze({ system, population: system.initialPopulationBillions });
  if (
    policy.canReachSurface(
      Object.freeze({
        ...context,
        playerPosition: player.location.position,
        playerDefinitionId: player.definitionId,
        playerHeadingDegrees: player.location.rotationDegrees,
        planetPosition: planet.location.position,
        cameraZoom: world.cameraZoom,
      })
    ) !== true
  )
    return world;
  const pod = player.inventory.cargo.find(pod => pod.contract?.destinationSystemId === system.id);
  const balance = player.inventory.resources[policy.paymentResourceId];
  if (balance === undefined) return world;
  if (pod?.contract) {
    const nextBalance = balance + pod.contract.payout;
    if (!Number.isFinite(nextBalance) || nextBalance > Number.MAX_SAFE_INTEGER) return world;
    const message = NoticeMessageSchema.parse(
      policy.describeContractDelivery(
        Object.freeze({
          ...context,
          payout: pod.contract.payout,
          tons: pod.tons,
          goodsLabel: game.definition.commerce?.goods.find(goods => goods.id === pod.goodsId)?.label,
        })
      )
    );
    const next = publishSurface(world, message, {
      ...player.inventory,
      cargo: player.inventory.cargo.filter(item => item.slot !== pod.slot),
      resources: { ...player.inventory.resources, [policy.paymentResourceId]: nextBalance },
    });
    return resolveProgression(next, game.rules, game.definition.progression, {
      kind: 'contract-delivery',
      destinationSystemId: system.id,
    });
  }
  if (context.population <= 0) return world;
  const missionIndex = world.missions.surfaceMissionIndex;
  const consumed = parseWorldState({ ...world, missions: { ...world.missions, surfaceMissionIndex: 0 } });
  const result = SurfaceMissionResultSchema.parse(
    policy.resolveSurfaceMission(Object.freeze({ ...context, missionIndex }))
  );
  if (missionIndex === 0 && result.standingDelta !== 0) throw Error('Surface fallback cannot change standing.');
  const next = publishSurface(
    parseWorldState({
      ...consumed,
      lifecycle: {
        ...consumed.lifecycle,
        systemStanding:
          result.standingDelta === 0
            ? consumed.lifecycle.systemStanding
            : applyStandingDelta(consumed.lifecycle.systemStanding, system.id, result.standingDelta),
      },
    }),
    result.message,
    player.inventory
  );
  return resolveProgression(next, game.rules, game.definition.progression, {
    kind: 'surface-mission',
    standingDelta: result.standingDelta,
  });
}

/** Notice and inventory share a single validated candidate publication. */
function publishSurface(
  world: WorldState,
  message: string,
  inventory: ReturnType<typeof selectPlayerEntity>['inventory']
): WorldState {
  const player = selectPlayerEntity(world),
    sequence = (player.feedback.notice?.sequence ?? 0) + 1;
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(sequence);
  return parseWorldState({
    ...world,
    entities: world.entities.map(entity =>
      entity.id !== player.id
        ? entity
        : {
            ...player,
            inventory,
            feedback: { ...player.feedback, notice: { sequence, code: 'surface-mission', message } },
          }
    ),
  });
}
