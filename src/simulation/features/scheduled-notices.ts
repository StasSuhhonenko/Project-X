/**
 * Delayed player notices (world `scheduledNotices`).
 *
 * A module may ask for a notice to reach the player some fixed ticks after the
 * event that caused it; BM1 posts its "large explosion" notice only once the
 * dying clip's explosion frames have played. The entry is part of the saved
 * world, so a restore mid-delay posts it on the same tick. Travel drops every
 * pending entry with the system it belonged to.
 */
import { PlayerNoticeSchema } from '../model/entity-components';
import { parseWorldState, selectPlayerEntity, type WorldState } from '../model/world-state';

/** Post every notice due by this tick, in scheduling order. Each receives the
 * next sequence, so later ones replace earlier ones exactly as if they had
 * been published one by one. */
export function publishDueNotices(world: WorldState): WorldState {
  const due = world.scheduledNotices.filter(entry => entry.dueTick <= world.tick);
  if (due.length === 0) return world;
  const player = selectPlayerEntity(world);
  const first = (player.feedback.notice?.sequence ?? 0) + 1;
  const notice = PlayerNoticeSchema.parse({ ...due.at(-1)!.notice, sequence: first + due.length - 1 });
  return parseWorldState({
    ...world,
    scheduledNotices: world.scheduledNotices.filter(entry => entry.dueTick > world.tick),
    entities: world.entities.map(entity =>
      entity.kind === 'player-ship' ? { ...entity, feedback: { ...entity.feedback, notice } } : entity
    ),
  });
}
