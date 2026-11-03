/** Read-only world projections shared by simulation and presentation. */
import type { WorldState, PlayerShipEntity, NpcShipEntity, WorldEntity, SelectableWorldEntity } from './world-schema';
import { isSelectableWorldEntity } from './world-schema';
import { freezePlayerMovementState, type PlayerMovementState } from './player-state';
import { freezeNpcMovementState, type NpcMovementState } from './npc-state';

/** Return the stable frozen entity reference for focused UI component selectors. */
export function selectPlayerEntity(world: WorldState): PlayerShipEntity {
  const entity = selectWorldEntity(world, world.playerEntityId);
  if (!entity || entity.kind !== 'player-ship') throw new Error(`Missing player entity ${world.playerEntityId}.`);
  return entity;
}

/** Resolve one runtime identity without exposing mutation or presentation state. */
export function selectWorldEntity(world: WorldState, entityId: string): WorldEntity | undefined {
  return world.entities.find(entity => entity.id === entityId);
}

/** Return the selectable entities used by validation, hit testing and panels. */
export function selectSelectableWorldEntities(world: WorldState): readonly SelectableWorldEntity[] {
  return world.entities.filter(isSelectableWorldEntity);
}

/** Resolve the world-owned selection through the same eligibility authority. */
export function selectSelectedWorldTarget(world: WorldState): SelectableWorldEntity | null {
  if (world.selectedTargetEntityId === null) return null;
  const target = selectWorldEntity(world, world.selectedTargetEntityId);
  if (!target || !isSelectableWorldEntity(target)) {
    throw new Error('Selected target does not resolve to a selectable entity.');
  }
  return target;
}

/** Project only the fields navigation and primary-fire eligibility consume. */
export function selectPlayerMovementState(world: WorldState): PlayerMovementState {
  const entity = selectPlayerEntity(world);
  return freezePlayerMovementState({
    position: entity.location.position,
    rotationDegrees: entity.location.rotationDegrees,
    speedPerFrame: entity.motion.speedPerFrame,
    flightMode: entity.motion.flightMode,
    energy: entity.condition.energy,
    notice: entity.feedback.notice,
    repairing: entity.condition.repairing,
  });
}

/** Project only the navigation fields an NPC steering rule may replace. */
export function selectNpcMovementState(npc: NpcShipEntity): NpcMovementState {
  return freezeNpcMovementState({
    position: npc.location.position,
    rotationDegrees: npc.location.rotationDegrees,
    motion: npc.motion,
    targetOffset: npc.navigation.targetOffset,
  });
}

