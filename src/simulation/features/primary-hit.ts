/** Resolve one newly accepted primary shot against its recorded NPC target. */
import type { ShipDefinition, WeaponDefinition } from '../../content/schemas/game-content';
import type { GameRules } from '../contracts/game-rules';
import { DurabilityComponentSchema, type DurabilityComponent } from '../model/entity-components';
import {
  selectWorldEntity,
  type NpcDurabilityUpdate,
  type PrimaryWeaponState,
  type WorldState,
} from '../model/world-state';

export interface PrimaryHitResolution {
  readonly armament: PrimaryWeaponState;
  readonly npcDurabilityUpdates: readonly NpcDurabilityUpdate[];
}

/**
 * Consume an accepted sequence exactly once. Missing or already-destroyed
 * targets consume the sequence without damage so stale commands cannot retry.
 * Module code owns damage arithmetic/order; shared code validates monotonic
 * durability and commits the result with the rest of the tick.
 */
export function resolvePrimaryHit(
  world: WorldState,
  armament: PrimaryWeaponState,
  vessel: ShipDefinition,
  weapon: WeaponDefinition | null,
  rules: Pick<GameRules, 'resolvePrimaryHit'>,
): PrimaryHitResolution {
  const shot = armament.lastAcceptedShot;
  if (!shot || armament.resolvedShotSequence === shot.sequence) {
    return { armament, npcDurabilityUpdates: [] };
  }
  if (armament.resolvedShotSequence > shot.sequence) {
    throw new Error('Primary hit sequence is ahead of the accepted shot.');
  }
  const resolvedArmament = Object.freeze({ ...armament, resolvedShotSequence: shot.sequence });
  const target = selectWorldEntity(world, shot.targetEntityId);
  if (!target || target.kind !== 'npc-ship' || target.condition.hull === 0) {
    return { armament: resolvedArmament, npcDurabilityUpdates: [] };
  }
  if (!weapon || weapon.id !== shot.weaponDefinitionId || weapon.baseDamage <= 0) {
    throw new Error('Accepted primary shot does not resolve to its damage definition.');
  }
  const condition = DurabilityComponentSchema.parse(rules.resolvePrimaryHit(Object.freeze({
    attacker: Object.freeze({ sizeClass: vessel.sizeClass }),
    weapon: Object.freeze({ id: weapon.id, baseDamage: weapon.baseDamage }),
    target: Object.freeze({ condition: target.condition }),
  })));
  if (condition.hull > target.condition.hull || condition.shields > target.condition.shields) {
    throw new Error('Module primary hit cannot increase target durability.');
  }
  const frozenCondition: DurabilityComponent = Object.freeze({ ...condition });
  return {
    armament: resolvedArmament,
    npcDurabilityUpdates: Object.freeze([{ id: target.id, condition: frozenCondition }]),
  };
}
