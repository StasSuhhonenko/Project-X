/** Departure is removal, never a lifecycle death. The module supplies wording
 * and the warp-out length; persistent census, membership, strength and outcome
 * streams remain untouched. An owned fleet ship that departs keeps its roster
 * entry and system (source departure Symbol-12-26922 never touches myfleet);
 * only its live link ends, so it reappears on the next visit. BM1 never departs
 * government 16, but the engine must not publish a dangling deployment for
 * another module's policy.
 *
 * Lifecycle of one departure (all in fixed ticks):
 * 1. `beginActorDeparture` on the deciding tick. A zero duration removes the
 *    actor at once. Otherwise it records `departure.elapsedTicks = 0` and the
 *    actor stays in its slot, at its position, but becomes inert: it no longer
 *    decides or moves, hits on it are consumed without damage, and it stops
 *    being a selectable contact (selection on it is released immediately).
 * 2. `advanceActorDepartures` at the start of every later NPC phase adds one
 *    elapsed tick. On the tick it would reach `durationTicks` the actor is
 *    removed and its notice is published, exactly like the source clip's final
 *    frame (`Symbol-12-26922.as`) after its warp frames have played.
 */
import type { NpcDecision } from '../contracts/npc-decision-rules';
import { clearActorTarget } from '../model/decision-actor';
import { PlayerNoticeSchema, type UnsequencedNotice } from '../model/entity-components';
import { NpcDepartureStateSchema, type NpcDepartureState } from '../model/npc-state';
import {
  parseWorldState,
  selectPlayerEntity,
  selectWorldEntity,
  type NpcShipEntity,
  type WorldState,
} from '../model/world-state';

type DepartingShip = NpcShipEntity & { readonly departure: NpcDepartureState };
const isDepartingShip = (entity: WorldState['entities'][number]): entity is DepartingShip =>
  entity.kind === 'npc-ship' && entity.departure !== null;

/** Remove one live mobile actor now and tell the player it has left. */
export function departActor(world: WorldState, id: string, notice: UnsequencedNotice): WorldState {
  const player = selectPlayerEntity(world);
  const published = PlayerNoticeSchema.parse({ ...notice, sequence: (player.feedback.notice?.sequence ?? 0) + 1 });
  const removed = removeMobileActors(world, [id]);
  return parseWorldState({
    ...removed,
    entities: removed.entities.map(entity =>
      entity.kind === 'player-ship' ? { ...entity, feedback: { ...entity.feedback, notice: published } } : entity
    ),
  });
}

/** Apply a validated decision's departure intent to its (live, mobile) actor. */
export function beginActorDeparture(
  world: WorldState,
  id: string,
  intent: NonNullable<NpcDecision['departure']>
): WorldState {
  const { durationTicks, ...notice } = intent;
  if (durationTicks === 0) return departActor(world, id, notice);
  const actor = selectWorldEntity(world, id);
  if (actor?.kind !== 'npc-ship') throw new Error('Departure requires a live mobile actor.');
  if (isDepartingShip(actor)) throw new Error('An actor cannot depart twice.');
  const departure = NpcDepartureStateSchema.parse({ elapsedTicks: 0, durationTicks, notice });
  return parseWorldState({
    ...world,
    // The ship is no longer a contact; panels and fire lose it at once.
    selectedTargetEntityId: world.selectedTargetEntityId === id ? null : world.selectedTargetEntityId,
    entities: world.entities.map(entity => (entity.id === id ? { ...actor, departure } : entity)),
  });
}

/** Advance every departure begun on an earlier tick, removing completed ones
 * in slot/entity order (each removal publishes its own notice sequence). */
export function advanceActorDepartures(world: WorldState): WorldState {
  const departing = world.entities.filter(isDepartingShip);
  if (departing.length === 0) return world;
  const completed = departing.filter(actor => actor.departure.elapsedTicks + 1 >= actor.departure.durationTicks);
  const stepped = parseWorldState({
    ...world,
    entities: world.entities.map(entity => {
      if (!isDepartingShip(entity) || completed.includes(entity)) return entity;
      return { ...entity, departure: { ...entity.departure, elapsedTicks: entity.departure.elapsedTicks + 1 } };
    }),
  });
  return completed.reduce((state, actor) => departActor(state, actor.id, actor.departure.notice), stepped);
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
