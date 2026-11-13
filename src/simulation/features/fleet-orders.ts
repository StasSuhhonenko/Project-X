/** Orders own live deployment intent; missions own persistent roster intent.
 * Policies receive detached validated facts and never mutate the world. Each
 * operation prepares a complete candidate for one host publication. */
import { z } from 'zod';
import type { GameModule } from '../../content/game-module';
import {
  FleetOrderContextSchema,
  FleetOrderResolutionSchema,
  FleetRecallContextSchema,
} from '../contracts/fleet-rules';
import { NoticeMessageSchema, PlayerNoticeSchema, RuntimeEntityIdSchema } from '../model/entity-components';
import { parseWorldState, selectPlayerEntity, type WorldState } from '../model/world-state';
import { removeMobileActors } from './departure';
import { initializeFleetPresence } from './fleet';

const Recipients = z.array(RuntimeEntityIdSchema).readonly();
const Feedback = { notice: NoticeMessageSchema.optional() };
export const FleetOrderIntentSchema = z
  .object({ commandId: z.string().min(1), recipientEntityIds: Recipients, ...Feedback })
  .strict()
  .readonly();
export const FleetMissionIntentSchema = z
  .object({ missionId: z.string().min(1).nullable(), recipientEntityIds: Recipients, ...Feedback })
  .strict()
  .readonly();
export const FleetLaunchIntentSchema = z.object(Feedback).strict().readonly();
export const FleetRecallIntentSchema = z
  .object({ recipientEntityIds: Recipients, ...Feedback })
  .strict()
  .readonly();
export type FleetOrderIntent = z.infer<typeof FleetOrderIntentSchema>;
export type FleetMissionIntent = z.infer<typeof FleetMissionIntentSchema>;
export type FleetLaunchIntent = z.infer<typeof FleetLaunchIntentSchema>;
export type FleetRecallIntent = z.infer<typeof FleetRecallIntentSchema>;

function available(world: WorldState, game: GameModule) {
  return world.status === 'active' && world.fleet && game.rules.fleet?.orders;
}
/** Filter before policy invocation: stale UI selections cannot address sold,
 * removed, remote or non-owned actors. Input order is retained, duplicates removed. */
function recipients(world: WorldState, ids: readonly string[]) {
  const systemId = selectPlayerEntity(world).location.systemId;
  return [...new Set(ids)].filter(id => {
    const link = world.fleet!.deployments.find(link => link.entityId === id);
    const ship = world.fleet!.ships.find(ship => ship.id === link?.ownedShipId);
    return (
      ship?.systemId === systemId &&
      world.entities.some(actor => actor.id === id && actor.kind === 'npc-ship' && actor.condition.hull > 0)
    );
  });
}
/** Notice sequences distinguish repeated commands, including empty scans. */
function withNotice(world: WorldState, message: string | undefined | null): WorldState {
  if (message == null) return world;
  const player = selectPlayerEntity(world);
  const notice = PlayerNoticeSchema.parse({
    code: 'fleet-command',
    message,
    sequence: (player.feedback.notice?.sequence ?? 0) + 1,
  });
  return parseWorldState({
    ...world,
    entities: world.entities.map(actor =>
      actor.id === player.id ? { ...player, feedback: { ...player.feedback, notice } } : actor
    ),
  });
}
export function publishFleetNotice(world: WorldState, game: GameModule, message: string): WorldState | null {
  if (!available(world, game)) return null;
  return withNotice(world, NoticeMessageSchema.parse(message));
}
export function issueFleetOrder(world: WorldState, game: GameModule, input: FleetOrderIntent): WorldState | null {
  const rules = available(world, game);
  if (!rules) return null;
  const parsed = FleetOrderIntentSchema.safeParse(input);
  if (!parsed.success) return null;
  const intent = parsed.data;
  const ids = recipients(world, intent.recipientEntityIds);
  const planet = world.entities.find(actor => actor.kind === 'planet');
  if (!planet) return null;
  const result = FleetOrderResolutionSchema.parse(
    rules.resolveOrder(
      FleetOrderContextSchema.parse({
        commandId: intent.commandId,
        recipientEntityIds: ids,
        playerEntityId: world.playerEntityId,
        planetEntityId: planet.id,
        selectedTargetEntityId: world.selectedTargetEntityId,
      })
    )
  );
  if (
    new Set(result.writes.map(write => write.entityId)).size !== result.writes.length ||
    result.writes.some(
      write =>
        !ids.includes(write.entityId) ||
        (write.orderId !== null && !rules.declaredOrders.some(order => order.id === write.orderId)) ||
        (write.targetEntityId !== null &&
          !world.entities.some(
            actor =>
              actor.id === write.targetEntityId &&
              actor.location.systemId === selectPlayerEntity(world).location.systemId
          ))
    )
  )
    throw Error('Fleet order policy returned an invalid recipient, order or target.');
  const next =
    result.writes.length === 0
      ? world
      : parseWorldState({
          ...world,
          fleet: {
            ...world.fleet!,
            deployments: world.fleet!.deployments.map(link => {
              const write = result.writes.find(write => write.entityId === link.entityId);
              return write ? { ...link, orderId: write.orderId } : link;
            }),
          },
          entities: world.entities.map(actor => {
            const write = result.writes.find(write => write.entityId === actor.id);
            if (!write || actor.kind !== 'npc-ship') return actor;
            return {
              ...actor,
              combat: { ...actor.combat, alert: write.alert },
              navigation: { ...actor.navigation, targetEntityId: write.targetEntityId },
            };
          }),
        });
  const candidate = withNotice(next, intent.notice ?? result.notice);
  return candidate === world ? null : candidate;
}
export function setFleetMission(world: WorldState, game: GameModule, input: FleetMissionIntent): WorldState | null {
  const rules = available(world, game);
  if (!rules) return null;
  const parsed = FleetMissionIntentSchema.safeParse(input);
  if (!parsed.success) return null;
  const intent = parsed.data;
  if (intent.missionId !== null && !rules.declaredMissions.includes(intent.missionId)) return null;
  const ids = recipients(world, intent.recipientEntityIds);
  const ownedIds = world.fleet!.deployments.filter(link => ids.includes(link.entityId)).map(link => link.ownedShipId);
  const changed = world.fleet!.ships.some(ship => ownedIds.includes(ship.id) && ship.missionId !== intent.missionId);
  const next = changed
    ? parseWorldState({
        ...world,
        fleet: {
          ...world.fleet!,
          ships: world.fleet!.ships.map(ship =>
            ownedIds.includes(ship.id) ? { ...ship, missionId: intent.missionId } : ship
          ),
        },
      })
    : world;
  const candidate = withNotice(next, intent.notice);
  return candidate === world ? null : candidate;
}
export function launchStowedFleet(
  world: WorldState,
  game: GameModule,
  input: FleetLaunchIntent = {}
): WorldState | null {
  if (!available(world, game)) return null;
  const parsed = FleetLaunchIntentSchema.safeParse(input);
  if (!parsed.success) return null;
  const stowedIds = world.fleet!.ships.filter(ship => ship.systemId === null).map(ship => ship.id);
  const positioned =
    stowedIds.length === 0
      ? world
      : parseWorldState({
          ...world,
          fleet: {
            ...world.fleet!,
            ships: world.fleet!.ships.map(ship =>
              ship.systemId === null ? { ...ship, systemId: selectPlayerEntity(world).location.systemId } : ship
            ),
          },
        });
  // The entry placement owner advances the world stream sequentially in roster
  // order. Restrict it to launched IDs, never unrelated undeployed visit rows.
  const next = initializeFleetPresence(positioned, game, new Set(stowedIds));
  const candidate = withNotice(next, parsed.data.notice);
  return candidate === world ? null : candidate;
}
export function recallFleet(world: WorldState, game: GameModule, input: FleetRecallIntent): WorldState | null {
  const rules = available(world, game);
  if (!rules) return null;
  const parsed = FleetRecallIntentSchema.safeParse(input);
  if (!parsed.success) return null;
  const player = selectPlayerEntity(world);
  const ids = recipients(world, parsed.data.recipientEntityIds).filter(id => {
    const actor = world.entities.find(actor => actor.id === id)!;
    if (actor.kind !== 'npc-ship') return false;
    return z.boolean().parse(
      rules.canRecall(
        FleetRecallContextSchema.parse({
          playerVessel: game.catalog.getShipDefinition(player.definitionId),
          craftVessel: game.catalog.getShipDefinition(actor.definitionId),
          playerPosition: player.location.position,
          craftPosition: actor.location.position,
          cameraZoom: world.cameraZoom,
        })
      )
    );
  });
  const ownedIds = world.fleet!.deployments.filter(link => ids.includes(link.entityId)).map(link => link.ownedShipId);
  // Outcome-free removal: no hit/death owner, explosion, tally or stream draw.
  const removed = removeMobileActors(world, ids);
  const next =
    ids.length === 0
      ? world
      : parseWorldState({
          ...removed,
          fleet: {
            ...removed.fleet!,
            ships: world.fleet!.ships.map(ship => (ownedIds.includes(ship.id) ? { ...ship, systemId: null } : ship)),
          },
        });
  const candidate = withNotice(next, parsed.data.notice);
  return candidate === world ? null : candidate;
}
