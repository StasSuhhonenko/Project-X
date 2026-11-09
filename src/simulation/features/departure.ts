/** Departure is removal, never a lifecycle death. The module supplies wording;
 * persistent census, membership, strength and outcome streams remain untouched. */
import type { NpcDecision } from '../contracts/npc-decision-rules';
import { clearActorTarget } from '../model/decision-actor';
import { PlayerNoticeSchema } from '../model/entity-components';
import { parseWorldState, selectPlayerEntity, selectWorldEntity, type WorldState } from '../model/world-state';

export function departActor(world: WorldState, id: string, intent: NonNullable<NpcDecision['departure']>): WorldState {
  const actor = selectWorldEntity(world, id);
  if (!actor || actor.kind !== 'npc-ship') throw new Error('Departure requires a live mobile actor.');
  const player = selectPlayerEntity(world);
  const notice = PlayerNoticeSchema.parse({ ...intent, sequence: (player.feedback.notice?.sequence ?? 0) + 1 });
  return parseWorldState({
    ...world,
    selectedTargetEntityId: world.selectedTargetEntityId === id ? null : world.selectedTargetEntityId,
    specialActorSlots: world.specialActorSlots.map(slot => (slot === id ? null : slot)),
    entities: world.entities
      .filter(entity => entity.id !== id)
      .map(entity => {
        if (entity.kind === 'player-ship') return { ...entity, feedback: { ...entity.feedback, notice } };
        return clearActorTarget(entity, id);
      }),
  });
}
