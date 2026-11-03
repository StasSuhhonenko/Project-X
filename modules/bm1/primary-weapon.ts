/** Phaser-family (weapon IDs1–5) command gate from recovered scene handlers. */
import type {
  PrimaryFireApproval,
  PrimaryFireContext,
} from '../../src/simulation/contracts/game-rules';

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
  if (weapon.id < 1 || weapon.id > 5) return null;
  if (player.repairing || player.flightMode === 'warp' || player.energy <= weapon.energyCost) return null;
  const stage = worldToSourceStage(target.position, player.position, zoom);
  if (Math.abs(PHASER_SOURCE_ORIGIN.x - stage.x) >= PHASER_RANGE_PER_AXIS / zoom
    || Math.abs(PHASER_SOURCE_ORIGIN.y - stage.y) >= PHASER_RANGE_PER_AXIS / zoom) return null;
  return Object.freeze({ cooldownFramesBeforeEndOfTick: weapon.cooldownFrames * (6 - vessel.sizeClass) });
}
