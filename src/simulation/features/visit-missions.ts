/** Generate once after visit commerce. Restore replays captured entry facts,
 * never consuming RNG or recreating a removed/consumed offer. */
import type { GameModule } from '../../content/game-module';
import { hasExactStandingScope } from '../model/lifecycle-state';
import {
  ContractNegotiationResultSchema,
  VisitMissionsResultSchema,
  type VisitMissionState,
} from '../model/mission-state';
import { validateProgressionState } from '../model/progression-state';
import { parseWorldState, selectPlayerEntity, type WorldState } from '../model/world-state';

function generate(
  world: WorldState,
  game: GameModule,
  entry: Pick<VisitMissionState, 'seed' | 'entryStanding' | 'stationIds' | 'stationMarketSeeds'>
) {
  const system = game.definition.systems.find(system => system.id === selectPlayerEntity(world).location.systemId);
  if (!system || !game.rules.missions) throw Error('Mission capability or system is unavailable.');
  const result = VisitMissionsResultSchema.parse(
    game.rules.missions.createVisitMissions(
      Object.freeze({
        seed: entry.seed,
        system,
        systems: game.definition.systems,
        standing: entry.entryStanding,
        stationIds: entry.stationIds,
        stationMarketSeeds: entry.stationMarketSeeds,
      })
    )
  );
  if (
    Object.keys(result.stationOffers).length !== entry.stationIds.length ||
    entry.stationIds.some(id => !(id in result.stationOffers))
  )
    throw Error('Mission offers must name exactly the captured station identities.');
  [result.planetOffer, ...Object.values(result.stationOffers)].forEach(offer => {
    if (!offer) return;
    if (
      offer.negotiated ||
      !game.definition.commerce?.goods.some(goods => goods.id === offer.goodsId) ||
      !game.definition.systems.some(system => system.id === offer.destinationSystemId)
    )
      throw Error('Generated mission contains unavailable goods, destination or negotiation state.');
  });
  return result;
}

/** Capture the current visit stream exactly as C6 does, after commerce. Policy
 * returns the advanced stream. No capability means no state and no RNG draws. */
export function initializeVisitMissions(world: WorldState, game: GameModule): WorldState {
  if (!game.rules.missions || world.missions) return world;
  if (!game.definition.resources.some(resource => resource.id === game.rules.missions!.paymentResourceId))
    throw Error('Mission payment must use a declared resource.');
  const entry = Object.freeze({
    seed: world.randomState,
    entryStanding: world.lifecycle.systemStanding,
    stationMarketSeeds: Object.freeze(
      Object.fromEntries(
        world.entities.flatMap(entity =>
          entity.kind === 'station' && entity.commodityMarket ? [[entity.stationId, entity.commodityMarket.seed]] : []
        )
      )
    ),
    stationIds: Object.freeze(
      world.entities.filter(entity => entity.kind === 'station').map(entity => entity.stationId)
    ),
  });
  const result = generate(world, game, entry);
  return parseWorldState({
    ...world,
    randomState: result.randomState,
    missions: {
      ...result,
      ...entry,
      visitEntityId: world.entities.find(entity => entity.kind === 'planet')!.id,
      systemId: selectPlayerEntity(world).location.systemId,
      negotiations: {},
    },
  });
}

/** Content consistency, not authenticated history: consumed offers may remain
 * absent. Live prices must replay from creation plus a successful negotiation. */
export function validateSavedMissions(world: WorldState, game: GameModule): void {
  const player = selectPlayerEntity(world),
    state = world.missions,
    policy = game.rules.missions;
  player.inventory.cargo.forEach(pod => {
    if (!pod.contract) return;
    if (!policy || !game.definition.systems.some(system => system.id === pod.contract!.destinationSystemId))
      throw Error('Saved delivery contract has an unavailable capability or destination.');
  });
  if (!policy) {
    if (state) throw Error('Saved missions require a declared capability.');
    return;
  }
  if (
    !state ||
    state.visitEntityId !== world.entities.find(entity => entity.kind === 'planet')?.id ||
    state.systemId !== player.location.systemId ||
    !game.definition.resources.some(resource => resource.id === policy.paymentResourceId)
  )
    throw Error('Saved mission visit or payment resource is unavailable.');
  const system = game.definition.systems.find(system => system.id === state.systemId)!;
  if (
    new Set(state.stationIds).size !== state.stationIds.length ||
    state.stationIds.some(id => !system.stations.some(station => station.id === id)) ||
    world.entities.some(entity => entity.kind === 'station' && !state.stationIds.includes(entity.stationId)) ||
    !hasExactStandingScope(
      state.entryStanding,
      world.lifecycle.systemStanding.map(entry => entry.systemId)
    )
  )
    throw Error('Saved mission entry context differs from declared scope.');
  const generated = generate(world, game, state);
  const marketIds = state.stationIds.filter(
    id =>
      Boolean(game.definition.commerce) &&
      Boolean(system.stations.find(station => station.id === id)?.commodityMarketSlots?.length)
  );
  if (
    Object.keys(state.stationMarketSeeds).length !== marketIds.length ||
    Object.keys(state.stationMarketSeeds).some(id => !marketIds.includes(id)) ||
    world.entities.some(
      entity =>
        entity.kind === 'station' &&
        entity.commodityMarket &&
        state.stationMarketSeeds[entity.stationId] !== entity.commodityMarket.seed
    )
  )
    throw Error('Saved mission market replay seeds differ from commerce.');
  if (
    state.randomState !== generated.randomState ||
    (state.surfaceMissionIndex !== 0 && state.surfaceMissionIndex !== generated.surfaceMissionIndex)
  )
    throw Error('Saved mission index differs from its creation seed.');
  if (state.planetOffer && JSON.stringify(state.planetOffer) !== JSON.stringify(generated.planetOffer))
    throw Error('Saved planet offer differs from its creation seed.');
  if (
    Object.keys(state.stationOffers).length !== state.stationIds.length ||
    state.stationIds.some(id => !(id in state.stationOffers))
  )
    throw Error('Saved station mission identities differ.');
  Object.entries(state.negotiations).forEach(([id, receipt]) => {
    const original = generated.stationOffers[id];
    if (!original || JSON.stringify(receipt.offer) !== JSON.stringify(original))
      throw Error('Saved negotiation has no originating offer.');
    if (receipt.progression && game.definition.progression)
      validateProgressionState(receipt.progression, game.definition.progression);
    if (Boolean(receipt.progression) !== Boolean(world.progression))
      throw Error('Saved negotiation progression capability differs.');
    const result = ContractNegotiationResultSchema.parse(policy.resolveContractNegotiation(receipt));
    if (!result.success) throw Error('Saved live negotiation must have succeeded.');
    const offer = state.stationOffers[id];
    if (
      !offer ||
      JSON.stringify(offer) !== JSON.stringify({ ...original, basePayPerTon: result.basePayPerTon, negotiated: true })
    )
      throw Error('Saved negotiated offer differs from policy replay.');
  });
  Object.entries(state.stationOffers).forEach(([id, offer]) => {
    if (!offer || state.negotiations[id]) return;
    if (JSON.stringify(offer) !== JSON.stringify(generated.stationOffers[id]))
      throw Error('Saved station offer differs from its creation seed.');
  });
}
