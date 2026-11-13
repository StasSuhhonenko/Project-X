/** Atomic optional fleet operations. Every policy result is validated before
 * publication. A caller supplies session currency; the app host checks it against
 * its session owner, while this owner authenticates roster and world currency. */
import { z } from 'zod';
import type { GameModule } from '../../content/game-module';
import {
  FleetAcquisitionContextSchema,
  FleetAcquisitionDecisionSchema,
  FleetReleaseContextSchema,
  FleetReleaseQuoteSchema,
  FleetShipCreationContextSchema,
  FleetShipCreationSchema,
  FleetShipPlacementContextSchema,
  FleetShipPlacementSchema,
} from '../contracts/fleet-rules';
import { createEncounterActor } from '../model/encounter-actor';
import { ResourceBalancesSchema, RuntimeEntityIdSchema } from '../model/entity-components';
import { appendFleetDeployment, OwnedShipIdSchema } from '../model/fleet-state';
import { parseWorldState, selectPlayerEntity, type WorldState } from '../model/world-state';
import { authenticateVesselOffer } from './vessel-offer';

const Revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const FleetAcquisitionIntentSchema = z
  .object({
    sessionRevision: Revision,
    rosterRevision: Revision,
    systemId: z.number().int().positive(),
    planetEntityId: RuntimeEntityIdSchema,
    stationEntityId: RuntimeEntityIdSchema.optional(),
    vesselDefinitionId: z.number().int().positive(),
  })
  .strict()
  .readonly();
export type FleetAcquisitionIntent = z.infer<typeof FleetAcquisitionIntentSchema>;
export const FleetReleaseIntentSchema = z
  .object({
    sessionRevision: Revision,
    rosterRevision: Revision,
    ownedShipId: OwnedShipIdSchema,
    entityId: RuntimeEntityIdSchema,
  })
  .strict()
  .readonly();
export type FleetReleaseIntent = z.infer<typeof FleetReleaseIntentSchema>;

/** Policy government IDs are checked both at activation and at result boundaries. */
function requireGovernment(game: GameModule, id: number) {
  if (!game.definition.governments.some(row => row.id === id))
    throw Error('Fleet references an undeclared government.');
}
/** Capture joins the existing live actor through the purchase allocator. Birth
 * provenance, combat, condition and actor stream remain intact. Already-owned
 * capture deliberately does nothing rather than create duplicate ownership. */
export function captureFleetShip(world: WorldState, game: GameModule, entityId: string): WorldState {
  const fleet = world.fleet,
    rules = game.rules.fleet;
  if (!fleet || !rules) throw Error('Capture requires the fleet capability.');
  if (fleet.deployments.some(link => link.entityId === entityId)) return world;
  const actor = world.entities.find(actor => actor.id === entityId);
  if (actor?.kind !== 'npc-ship' || actor.condition.hull <= 0) throw Error('Capture requires a live ship.');
  requireGovernment(game, rules.ownedGovernmentId);
  const context = placementContext(world, game, actor.definitionId);
  const identity = actor.encounter ?? actor.generation;
  return parseWorldState({
    ...world,
    fleet: appendFleetDeployment(
      fleet,
      {
        definitionId: actor.definitionId,
        name: identity?.name ?? context.vessel.name,
        raceId: identity?.raceId ?? null,
        systemId: actor.location.systemId,
        ...(rules.orders ? { missionId: null } : {}),
      },
      actor.id
    ),
    specialActorSlots: world.specialActorSlots.includes(actor.id)
      ? world.specialActorSlots
      : [...world.specialActorSlots, actor.id],
    entities: world.entities.map(entity =>
      entity.id === actor.id ? { ...actor, governmentId: rules.ownedGovernmentId } : entity
    ),
  });
}
/** The session counter belongs to the app store, never to a saved world. */
export function isFleetAcquisitionIntentCurrent(
  world: WorldState,
  sessionRevision: number,
  intent: FleetAcquisitionIntent
): boolean {
  return intent.sessionRevision === sessionRevision && isFleetOfferCurrent(world, intent);
}
function isFleetOfferCurrent(world: WorldState, intent: FleetAcquisitionIntent): boolean {
  return (
    intent.rosterRevision === world.fleet?.nextOwnedShipSequence &&
    intent.systemId === selectPlayerEntity(world).location.systemId &&
    world.entities.some(
      actor =>
        actor.kind === 'planet' && actor.id === intent.planetEntityId && actor.location.systemId === intent.systemId
    )
  );
}
export function quoteFleetAcquisition(
  world: WorldState,
  game: GameModule,
  vesselDefinitionId: number,
  stationEntityId?: string
) {
  const rules = game.rules.fleet;
  if (!rules || !world.fleet) return null;
  const offer = authenticateVesselOffer(world, game, vesselDefinitionId, stationEntityId);
  if (!offer || offer.system.governmentId === null) return null;
  const decision = FleetAcquisitionDecisionSchema.parse(
    rules.evaluateAcquisition(
      FleetAcquisitionContextSchema.parse({
        sourceKind: offer.sourceKind,
        vessel: offer.nextVessel,
        system: offer.system,
        localGovernmentId: offer.system.governmentId,
        marketAdjustment: offer.player.equipment?.marketAdjustment ?? null,
        resources: offer.player.inventory.resources,
        ownedShipCount: world.fleet.ships.length,
        // Government and population currently have immutable system owners.
        // Future conquest/population changes must extend those owners, never
        // introduce a second fleet-maintained empire/capacity cache.
        empire: game.definition.systems.flatMap(system =>
          system.governmentId === null
            ? []
            : [
                {
                  systemId: system.id,
                  governmentId: system.governmentId,
                  populationBillions: system.initialPopulationBillions,
                },
              ]
        ),
      })
    )
  );
  if (offer.player.inventory.resources[decision.price.resourceId] === undefined)
    throw Error('Fleet price uses an undeclared resource.');
  return decision;
}
function placementContext(world: WorldState, game: GameModule, definitionId: number) {
  const player = selectPlayerEntity(world);
  const vessel = game.catalog.getShipDefinition(definitionId);
  const system = game.definition.systems.find(system => system.id === player.location.systemId);
  if (
    !vessel ||
    !system ||
    !game.definition.combatGeometry.entities.some(row => row.entityDefinitionId === definitionId)
  )
    throw Error('Fleet ship requires a declared hull, system and geometry.');
  return {
    vessel,
    system,
    randomState: world.randomState,
    playerPosition: player.location.position,
    cameraZoom: world.cameraZoom,
  };
}
export function acquireFleetShip(
  world: WorldState,
  game: GameModule,
  input: FleetAcquisitionIntent
): WorldState | null {
  const parsed = FleetAcquisitionIntentSchema.safeParse(input);
  if (!parsed.success) return null;
  const intent = parsed.data;
  // The pure world has no session counter. The app host must compare its own
  // session revision before calling; here only roster/system/planet currency is
  // owned by this boundary (the same split as the captain purchase operation).
  if (!isFleetOfferCurrent(world, intent)) return null;
  const rules = game.rules.fleet;
  const fleet = world.fleet;
  if (!rules || !fleet) return null;
  const decision = quoteFleetAcquisition(world, game, intent.vesselDefinitionId, intent.stationEntityId);
  if (!decision || decision.refusal !== null) return null;
  const player = selectPlayerEntity(world);
  const balance = player.inventory.resources[decision.price.resourceId];
  if (balance === undefined || balance < decision.price.amount) return null;
  requireGovernment(game, rules.ownedGovernmentId);
  const context = placementContext(world, game, intent.vesselDefinitionId);
  const created = FleetShipCreationSchema.parse(rules.createOwnedShip(FleetShipCreationContextSchema.parse(context)));
  const owned = {
    definitionId: context.vessel.id,
    name: created.name,
    raceId: created.raceId,
    systemId: context.system.id,
    ...(rules.orders ? { missionId: null } : {}),
  };
  const actor = createEncounterActor(
    world.nextEntitySequence,
    context.system.id,
    context.vessel,
    rules.ownedGovernmentId,
    owned,
    created,
    player.id
  );
  const resources = ResourceBalancesSchema.parse({
    ...player.inventory.resources,
    [decision.price.resourceId]: balance - decision.price.amount,
  });
  return parseWorldState({
    ...world,
    randomState: created.randomState,
    nextEntitySequence: world.nextEntitySequence + 1,
    fleet: appendFleetDeployment(fleet, owned, actor.id),
    specialActorSlots: [...world.specialActorSlots, actor.id],
    entities: [
      ...world.entities.map(entity =>
        entity.id === player.id ? { ...player, inventory: { ...player.inventory, resources } } : entity
      ),
      actor,
    ],
  });
}
/** Entry only. Already deployed rows are skipped defensively; restore never calls
 * this operation. Sequential reduction preserves roster/world-stream draw order. */
export function initializeFleetPresence(
  world: WorldState,
  game: GameModule,
  onlyOwnedIds?: ReadonlySet<string>
): WorldState {
  const rules = game.rules.fleet;
  if (!rules || !world.fleet) return world;
  requireGovernment(game, rules.ownedGovernmentId);
  return world.fleet.ships
    .filter(ship => ship.systemId === selectPlayerEntity(world).location.systemId)
    .filter(ship => !onlyOwnedIds || onlyOwnedIds.has(ship.id))
    .reduce((current, ship) => {
      if (current.fleet!.deployments.some(link => link.ownedShipId === ship.id)) return current;
      const context = placementContext(current, game, ship.definitionId);
      const placement = FleetShipPlacementSchema.parse(
        rules.placeOwnedShip(FleetShipPlacementContextSchema.parse({ ...context, name: ship.name }))
      );
      const actor = createEncounterActor(
        current.nextEntitySequence,
        context.system.id,
        context.vessel,
        rules.ownedGovernmentId,
        ship,
        placement,
        current.playerEntityId
      );
      return parseWorldState({
        ...current,
        randomState: placement.randomState,
        nextEntitySequence: current.nextEntitySequence + 1,
        fleet: {
          ...current.fleet!,
          deployments: [
            ...current.fleet!.deployments,
            { ownedShipId: ship.id, entityId: actor.id, ...(rules.orders ? { orderId: null } : {}) },
          ],
        },
        specialActorSlots: [...current.specialActorSlots, actor.id],
        entities: [...current.entities, actor],
      });
    }, world);
}
/** Shared by the view and release commit, including government/resource checks. */
export function quoteFleetRelease(world: WorldState, game: GameModule, ownedShipId: string, entityId: string) {
  const rules = game.rules.fleet;
  const fleet = world.fleet;
  if (!rules || !fleet || world.status !== 'active') return null;
  const ship = fleet.ships.find(ship => ship.id === ownedShipId);
  const actor = world.entities.find(actor => actor.id === entityId);
  if (
    !ship ||
    actor?.kind !== 'npc-ship' ||
    actor.condition.hull <= 0 ||
    actor.governmentId !== rules.ownedGovernmentId ||
    ship.systemId !== selectPlayerEntity(world).location.systemId ||
    !fleet.deployments.some(link => link.ownedShipId === ownedShipId && link.entityId === entityId)
  )
    return null;
  const context = placementContext(world, game, ship.definitionId);
  const result = rules.quoteRelease(
    FleetReleaseContextSchema.parse({
      vessel: context.vessel,
      system: context.system,
      resources: selectPlayerEntity(world).inventory.resources,
    })
  );
  if (result === null) return null;
  const quote = FleetReleaseQuoteSchema.parse(result);
  requireGovernment(game, quote.releasedGovernmentId);
  if (selectPlayerEntity(world).inventory.resources[quote.resourceId] === undefined)
    throw Error('Fleet release uses an undeclared resource.');
  return quote;
}
export function releaseFleetShip(world: WorldState, game: GameModule, input: FleetReleaseIntent): WorldState | null {
  const parsed = FleetReleaseIntentSchema.safeParse(input);
  if (!parsed.success || parsed.data.rosterRevision !== world.fleet?.nextOwnedShipSequence) return null;
  const intent = parsed.data;
  const quote = quoteFleetRelease(world, game, intent.ownedShipId, intent.entityId);
  const planet = world.entities.find(actor => actor.kind === 'planet');
  if (!quote || !planet) return null;
  const player = selectPlayerEntity(world);
  const resources = ResourceBalancesSchema.parse({
    ...player.inventory.resources,
    [quote.resourceId]: player.inventory.resources[quote.resourceId]! + quote.credit,
  });
  return parseWorldState({
    ...world,
    fleet: {
      ...world.fleet!,
      ships: world.fleet!.ships.filter(ship => ship.id !== intent.ownedShipId),
      deployments: world.fleet!.deployments.filter(link => link.ownedShipId !== intent.ownedShipId),
    },
    entities: world.entities.map(actor => {
      if (actor.id === player.id) return { ...player, inventory: { ...player.inventory, resources } };
      if (actor.id === intent.entityId && actor.kind === 'npc-ship')
        return {
          ...actor,
          governmentId: quote.releasedGovernmentId,
          navigation: { ...actor.navigation, targetEntityId: planet.id },
        };
      return actor;
    }),
  });
}
