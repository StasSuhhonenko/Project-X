/** Atomic entity-destruction and player-death transitions. */
import { DurabilityComponentSchema } from '../model/entity-components';
import {
  parseWorldState,
  selectPlayerEntity,
  type WorldState,
} from '../model/world-state';

/**
 * Remove every zero-hull NPC in one validated transaction. Selection and NPC
 * navigation references are cleared with the entities, so no published world
 * can retain a dangling runtime ID. The sensor notice is the only evidenced
 * outcome for the currently staged peaceful encounter; faction rewards require
 * the government/reputation state scheduled for the later progression slice.
 */
export function settleNpcDestruction(world: WorldState): WorldState {
  const destroyedIds = new Set(world.entities
    .filter(entity => entity.kind === 'npc-ship' && entity.condition.hull === 0)
    .map(entity => entity.id));
  if (destroyedIds.size === 0) return world;

  const player = selectPlayerEntity(world);
  const notice = Object.freeze({
    sequence: (player.feedback.notice?.sequence ?? 0) + 1,
    code: 'npc-destroyed',
    message: 'Sensors have detected a large explosion in this system...',
  });
  const entities = world.entities
    .filter(entity => !destroyedIds.has(entity.id))
    .map(entity => {
      if (entity.kind === 'player-ship') return { ...entity, feedback: { notice } };
      if (entity.kind !== 'npc-ship' || entity.navigation.targetEntityId === null
        || !destroyedIds.has(entity.navigation.targetEntityId)) return entity;
      return { ...entity, navigation: { ...entity.navigation, targetEntityId: null } };
    });

  return parseWorldState({
    ...world,
    selectedTargetEntityId: world.selectedTargetEntityId !== null
      && destroyedIds.has(world.selectedTargetEntityId) ? null : world.selectedTargetEntityId,
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
