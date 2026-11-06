/** Primary-channel command gates from recovered scene handlers. The supported
 * specials reuse this channel without installing C5's additional equipment. */
import type { PrimaryFireApproval, PrimaryFireContext } from '@engine/simulation/contracts/game-rules';
import { worldToSourceStage } from './source-geometry';

const PHASER_SOURCE_ORIGIN = { x: 296, y: 191 };
const PHASER_RANGE_PER_AXIS = 300;

/**
 * Return the source's size-scaled cooldown in 13 Hz ticks when the primary
 * phaser can be emitted. `firephaser()` checks separate X/Y stage distances,
 * not Euclidean range. The explicit flight mode prevents camera zoom alone
 * from classifying an impulse Saber as unable to fire.
 */
export function evaluatePrimaryFire(context: PrimaryFireContext): PrimaryFireApproval | null {
  const { player, vessel, weapon, target, cameraZoom: zoom } = context;
  if (weapon.id >= 22 && weapon.id <= 27) {
    if (player.repairing || player.flightMode === 'warp') return null;
    // Cloak bypasses the generic source guard. The host supplies zero cost for
    // a free disable and the complete affordable debit for the double branch.
    if (weapon.id === 22 || weapon.id === 26) {
      if (player.energy < weapon.energyCost) return null;
      return Object.freeze({ cooldownFramesBeforeEndOfTick: weapon.cooldownFrames * (6 - vessel.sizeClass) });
    }
    if (player.energy <= weapon.energyCost) return null;
    // Source charges before engagetractor checks range. A selected target is
    // required for dispatch; an out-of-range target remains a paid miss.
    if (weapon.id === 25 && !target) return null;
    return Object.freeze({ cooldownFramesBeforeEndOfTick: weapon.cooldownFrames * (6 - vessel.sizeClass) });
  }
  if (weapon.id < 1 || weapon.id > 19) return null;
  if (player.repairing || player.flightMode === 'warp' || player.energy <= weapon.energyCost) return null;
  if (weapon.id > 5) {
    if (weapon.id >= 11 && !target) return null;
    return Object.freeze({ cooldownFramesBeforeEndOfTick: weapon.cooldownFrames * (6 - vessel.sizeClass) });
  }
  if (!target) return null;
  const stage = worldToSourceStage(target.position, player.position, zoom);
  if (
    Math.abs(PHASER_SOURCE_ORIGIN.x - stage.x) >= PHASER_RANGE_PER_AXIS / zoom ||
    Math.abs(PHASER_SOURCE_ORIGIN.y - stage.y) >= PHASER_RANGE_PER_AXIS / zoom
  )
    return null;
  return Object.freeze({ cooldownFramesBeforeEndOfTick: weapon.cooldownFrames * (6 - vessel.sizeClass) });
}
