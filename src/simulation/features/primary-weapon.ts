/** Atomic primary-fire command: shared ownership, module-specific eligibility. */
import type { ShipDefinition, WeaponDefinition } from '../../content/schemas/game-content';
import type { LifecycleDefinition } from '../../content/schemas/lifecycle-content';
import type { GameRules } from '../contracts/game-rules';
import { canUseOwnedWeapon } from '../model/equipment-state';
import { freezePlayerMovementState, type PlayerMovementState } from '../model/player-state';
import {
  selectPlayerEntity,
  selectSelectedWorldTarget,
  type PrimaryWeaponState,
  type WorldState,
} from '../model/world-state';
import { getSpecialWeapon, updateSpecialWeapon, type SpecialWeaponTick } from './special-weapons';

export interface PrimaryWeaponTick extends SpecialWeaponTick {
  readonly playerMovement: PlayerMovementState;
  readonly armament: PrimaryWeaponState;
}

/**
 * Evaluate against post-navigation player state and the pre-NPC-motion target.
 * An accepted shot pays once, records one typed command and starts its module
 * cooldown; the lifecycle-hit feature consumes that sequence. The source counts
 * timers down at frame end, so a new N-frame timer closes this tick at N-1.
 */
export function updatePrimaryWeapon(
  world: WorldState,
  player: PlayerMovementState,
  vessel: ShipDefinition,
  weapon: WeaponDefinition | null,
  fireRequested: boolean,
  zoom: number,
  rules: GameRules,
  lifecycle?: LifecycleDefinition,
  armament: PrimaryWeaponState = selectPlayerEntity(world).armament
): PrimaryWeaponTick {
  const current = selectPlayerEntity(world);

  const special = weapon ? getSpecialWeapon(rules, weapon.id) : null;
  if (special && weapon)
    return updateSpecialWeapon(world, player, vessel, weapon, fireRequested, zoom, rules, special, armament);
  const countDown = (frames: number): PrimaryWeaponState =>
    Object.freeze({
      ...armament,
      cooldownRemainingFrames: Math.max(0, frames - 1),
    });
  if (current.specialStatus.cloaked || !fireRequested || !weapon || !armament.weaponDefinitionId) {
    return { playerMovement: player, armament: countDown(armament.cooldownRemainingFrames) };
  }
  if (
    armament.weaponDefinitionId !== weapon.id ||
    weapon.baseDamage <= 0 ||
    (current.equipment ? !canUseOwnedWeapon(vessel, weapon) : vessel.sizeClass < weapon.minimumSizeClass) ||
    armament.cooldownRemainingFrames > 0 ||
    player.energy < weapon.energyCost
  ) {
    return { playerMovement: player, armament: countDown(armament.cooldownRemainingFrames) };
  }
  const target = selectSelectedWorldTarget(world);
  if (!target && !rules.getProjectileFlight?.(weapon.id)) {
    return { playerMovement: player, armament: countDown(armament.cooldownRemainingFrames) };
  }
  if (
    target?.kind === 'station' &&
    (!target.combat || !lifecycle?.mutableStationRecordIds.includes(target.combat.recordId))
  ) {
    return { playerMovement: player, armament: countDown(armament.cooldownRemainingFrames) };
  }
  if (target?.kind === 'npc-ship' && target.condition.hull === 0) {
    return { playerMovement: player, armament: countDown(armament.cooldownRemainingFrames) };
  }
  const approval = rules.evaluatePrimaryFire({
    player: {
      position: player.position,
      energy: player.energy,
      repairing: player.repairing,
      flightMode: player.flightMode,
    },
    vessel: { sizeClass: vessel.sizeClass },
    weapon: { id: weapon.id, energyCost: weapon.energyCost, cooldownFrames: weapon.cooldownFrames },
    target: target
      ? {
          position: target.location.position,
          kind: target.kind,
          ...(target.kind === 'station' && target.combat ? { stationRecordId: target.combat.recordId } : {}),
        }
      : null,
    cameraZoom: zoom,
  });
  if (approval === null) {
    return { playerMovement: player, armament: countDown(armament.cooldownRemainingFrames) };
  }
  const cooldownFrames = approval.cooldownFramesBeforeEndOfTick;
  if (!Number.isFinite(cooldownFrames) || cooldownFrames < 0 || cooldownFrames > 100000) {
    throw new Error('Module returned an invalid primary-weapon cooldown.');
  }
  const sequence = armament.shotSequence + 1;
  return {
    progressionEvent: { kind: 'weapon-fire', weaponDefinitionId: weapon.id, channel: 'primary' },
    playerMovement: freezePlayerMovementState({ ...player, energy: player.energy - weapon.energyCost }),
    armament: Object.freeze({
      ...armament,
      cooldownRemainingFrames: Math.max(0, cooldownFrames - 1),
      shotSequence: sequence,
      lastAcceptedShot: Object.freeze({
        sequence,
        weaponDefinitionId: weapon.id,
        targetEntityId: target?.id ?? null,
        tick: world.tick + 1,
      }),
    }),
  };
}
