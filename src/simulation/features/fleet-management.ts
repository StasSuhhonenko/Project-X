/** Station-bound roster commands. An attachment addresses its station by
 * runtime ID and its ship by the persistent owned ID, even across selection changes. */
import { z } from 'zod';
import type { GameModule } from '../../content/game-module';
import { FleetManagementAccessContextSchema } from '../contracts/fleet-rules';
import { actorNavigation, isDecisionActor } from '../model/decision-actor';
import { RuntimeEntityIdSchema, SystemIdSchema } from '../model/entity-components';
import { OwnedShipIdSchema } from '../model/fleet-state';
import {
  parseWorldState,
  selectPlayerEntity,
  selectWorldEntity,
  type StationEntity,
  type WorldState,
} from '../model/world-state';
import { beginSilentDeparture } from './departure';
import { setFleetMissionForOwnedIds } from './fleet-orders';

const FleetManagementRecipient = {
  stationEntityId: RuntimeEntityIdSchema,
  ownedShipId: OwnedShipIdSchema,
};

export const FleetManagementIntentSchema = z
  .discriminatedUnion('kind', [
    z
      .object({
        ...FleetManagementRecipient,
        kind: z.literal('send'),
        destinationSystemId: SystemIdSchema,
      })
      .strict(),
    z.object({ ...FleetManagementRecipient, kind: z.literal('decommission') }).strict(),
    z.object({ ...FleetManagementRecipient, kind: z.literal('set-mission'), missionId: z.string().min(1) }).strict(),
  ])
  .readonly();
export type FleetManagementIntent = z.infer<typeof FleetManagementIntentSchema>;

/** Find current facilities in actor-slot order. Hail authenticates opening;
 * the attachment can survive later changes to player selection. */
export function selectFleetManagementStations(world: WorldState, game: GameModule): readonly StationEntity[] {
  const management = game.rules.fleet?.management;
  if (!management || world.status !== 'active') return [];
  const systemId = selectPlayerEntity(world).location.systemId;
  return Object.freeze(
    world.specialActorSlots.flatMap(id => {
      if (id === null) return [];
      const station = selectWorldEntity(world, id);
      if (station?.kind !== 'station' || station.location.systemId !== systemId || station.construction === 'pending')
        return [];
      const built = world.construction?.stations.find(record => record.id === station.stationId);
      if (built && built.phase.kind !== 'complete') return [];
      if (
        station.combat &&
        world.lifecycle.activeStationVisit?.settledStationRecordIds.includes(station.combat.recordId)
      )
        return [];
      const targetsPlayer =
        isDecisionActor(station) && actorNavigation(station).targetEntityId === world.playerEntityId;
      const admitted = z.boolean().parse(
        management.opensManagement(
          FleetManagementAccessContextSchema.parse({
            stationDefinitionId: station.definitionId,
            targetsPlayer,
          })
        )
      );
      return admitted ? [station] : [];
    })
  );
}

/** Only declared destinations with a spatial system can own a sent ship. */
export function canSendFleetToSystem(game: GameModule, systemId: number): boolean {
  return (
    game.rules.fleet?.management?.declarations.destinationSystemIds.includes(systemId) === true &&
    game.definition.systems.some(system => system.id === systemId)
  );
}

/** Prepare a detached roster transaction, or return null for a refusal or no-op. */
export function applyFleetManagement(
  world: WorldState,
  game: GameModule,
  input: FleetManagementIntent
): WorldState | null {
  const fleet = world.fleet;
  const management = game.rules.fleet?.management;
  if (!fleet || !management || world.status !== 'active') return null;
  const parsed = FleetManagementIntentSchema.safeParse(input);
  if (!parsed.success) return null;
  const intent = parsed.data;
  if (!selectFleetManagementStations(world, game).some(station => station.id === intent.stationEntityId)) return null;
  const ship = fleet.ships.find(row => row.id === intent.ownedShipId);
  if (!ship) return null;
  if (intent.kind === 'set-mission') return setFleetMissionForOwnedIds(world, game, [ship.id], intent.missionId);
  if (
    intent.kind === 'send' &&
    (ship.systemId === intent.destinationSystemId || !canSendFleetToSystem(game, intent.destinationSystemId))
  )
    return null;

  const link = fleet.deployments.find(deployment => deployment.ownedShipId === ship.id);
  const actor = link ? selectWorldEntity(world, link.entityId) : null;
  // An ordinary departure already owns this actor's animation and notice.
  // The surviving roster row can move or be removed when that departure ends.
  if (link && (actor?.kind !== 'npc-ship' || actor.departure !== null)) return null;

  const candidate = {
    ...world,
    fleet: {
      ...fleet,
      ships:
        intent.kind === 'send'
          ? fleet.ships.map(row => (row.id === ship.id ? { ...row, systemId: intent.destinationSystemId } : row))
          : fleet.ships.filter(row => row.id !== ship.id),
      deployments: fleet.deployments.filter(deployment => deployment.ownedShipId !== ship.id),
    },
  };
  // The source leaves the old clip until the player leaves. End the live join
  // now to keep one roster location, using the existing warp-out as visual
  // continuity. These commands have no source notice or death settlement.
  if (link) return beginSilentDeparture(candidate, link.entityId, management.declarations.departureTicks);
  return parseWorldState(candidate);
}
