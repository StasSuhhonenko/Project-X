/** Atomic entity-destruction and player-death transitions. */
import { captureActorDeath } from '../model/actor-death-event';
import { clearActorTarget } from '../model/decision-actor';
import { DurabilityComponentSchema } from '../model/entity-components';
import { parseWorldState, selectPlayerEntity, type WorldState } from '../model/world-state';

/** Retained fallback wording for modules which decline death outcomes. */
export const NPC_DESTRUCTION_NOTICE = Object.freeze({
  code: 'npc-destroyed',
  message: 'Sensors have detected a large explosion in this system...',
});

/**
 * Remove every zero-hull NPC in one validated transaction. Selection and NPC
 * navigation references are cleared with the entities, so no published world
 * can retain a dangling runtime ID. This outcome-free compatibility helper is
 * retained for direct callers without a death policy. Runtime hit hosts use
 * lifecycle-hit exclusively so policy-bearing deaths cannot bypass settlement.
 */
export function settleNpcDestruction(world: WorldState): WorldState {
  const destroyedIds = new Set(
    world.entities.filter(entity => entity.kind === 'npc-ship' && entity.condition.hull === 0).map(entity => entity.id)
  );
  if (destroyedIds.size === 0) return world;

  const player = selectPlayerEntity(world);
  const notice = Object.freeze({
    sequence: (player.feedback.notice?.sequence ?? 0) + 1,
    ...NPC_DESTRUCTION_NOTICE,
  });
  const entities = world.entities
    .filter(entity => !destroyedIds.has(entity.id))
    .map(entity => {
      if (entity.kind === 'player-ship') return { ...entity, feedback: { ...entity.feedback, notice } };
      return [...destroyedIds].reduce<WorldState['entities'][number]>(
        (actor, id) => clearActorTarget(actor, id),
        entity
      );
    });

  return parseWorldState({
    ...world,
    selectedTargetEntityId:
      world.selectedTargetEntityId !== null && destroyedIds.has(world.selectedTargetEntityId)
        ? null
        : world.selectedTargetEntityId,
    actorDeathEvents: [
      ...world.actorDeathEvents,
      ...world.entities.flatMap(actor =>
        actor.kind === 'npc-ship' && destroyedIds.has(actor.id) ? [captureActorDeath(actor, world.tick)] : []
      ),
    ],
    specialActorSlots: world.specialActorSlots.map(id => (id !== null && destroyedIds.has(id) ? null : id)),
    entities,
  });
}

/**
 * Commit module-computed damage to the player without granting healing. A
 * zero-hull result changes lifecycle status in the same publication, making a
 * half-dead, still-ticking world impossible at the validated boundary.
 */
export function commitPlayerDurability(world: WorldState, input: unknown): WorldState {
  if (world.status !== 'active') throw new Error('Cannot damage a destroyed player.');
  const condition = DurabilityComponentSchema.parse(input);
  const player = selectPlayerEntity(world);
  if (condition.hull > player.condition.hull || condition.shields > player.condition.shields) {
    throw new Error('Player damage cannot increase durability.');
  }
  if (condition.hull === player.condition.hull && condition.shields === player.condition.shields) return world;

  return parseWorldState({
    ...world,
    status: condition.hull === 0 ? 'player-destroyed' : 'active',
    selectedTargetEntityId: condition.hull === 0 ? null : world.selectedTargetEntityId,
    entities: world.entities.map(entity => {
      if (entity.kind !== 'player-ship') return entity;
      return {
        ...entity,
        condition: { ...entity.condition, ...condition },
        motion: { ...entity.motion, speedPerFrame: condition.hull === 0 ? 0 : entity.motion.speedPerFrame },
      };
    }),
  });
}
