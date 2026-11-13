/** Departure is removal, never a lifecycle death. The module supplies wording;
 * persistent census, membership, strength and outcome streams remain untouched.
 * An owned fleet ship that departs keeps its roster entry and system (source
 * departure Symbol-12-26922 never touches myfleet); only its live link ends, so
 * it reappears on the next visit. BM1 never departs government 16, but the
 * engine must not publish a dangling deployment for another module's policy. */
import type { NpcDecision } from '../contracts/npc-decision-rules';
import { clearActorTarget } from '../model/decision-actor';
import { PlayerNoticeSchema } from '../model/entity-components';
import { parseWorldState, selectPlayerEntity, selectWorldEntity, type WorldState } from '../model/world-state';

export function departActor(world: WorldState, id: string, intent: NonNullable<NpcDecision['departure']>): WorldState {
  const player = selectPlayerEntity(world);
  const notice = PlayerNoticeSchema.parse({ ...intent, sequence: (player.feedback.notice?.sequence ?? 0) + 1 });
  const removed = removeMobileActors(world, [id]);
  return parseWorldState({
    ...removed,
    entities: removed.entities.map(entity =>
      entity.kind === 'player-ship' ? { ...entity, feedback: { ...entity.feedback, notice } } : entity
    ),
  });
}

/** Sole outcome-free mobile removal and reference cleanup, shared by departure
 * and recall. Roster location/mission remain the caller's responsibility; this
 * ends only live deployment links. Historical shots and death events survive. */
export function removeMobileActors(world: WorldState, ids: readonly string[]): WorldState {
  if (ids.length === 0) return world;
  if (ids.some(id => selectWorldEntity(world, id)?.kind !== 'npc-ship'))
    throw new Error('Removal requires live mobile actors.');
  return parseWorldState({
    ...world,
    ...(world.fleet
      ? { fleet: { ...world.fleet, deployments: world.fleet.deployments.filter(link => !ids.includes(link.entityId)) } }
      : {}),
    selectedTargetEntityId: ids.includes(world.selectedTargetEntityId ?? '') ? null : world.selectedTargetEntityId,
    specialActorSlots: world.specialActorSlots.map(slot => (slot !== null && ids.includes(slot) ? null : slot)),
    entities: world.entities
      .filter(entity => !ids.includes(entity.id))
      .map(entity => ids.reduce((current, id) => clearActorTarget(current, id), entity)),
  });
}
