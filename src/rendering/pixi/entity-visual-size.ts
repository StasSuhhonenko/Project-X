/** Resolve entity artwork dimensions without altering its source bitmap. */
import type { PixiSceneDefinition } from './configuration';

/**
 * Return the unrotated logical dimensions at zoom one, in world pixels.
 * Native size remains the integer bitmap dimensions. A module may supply a
 * positive uniform and per-axis scales; absence preserves native sizing. The player role also
 * applies the optional playerScale multiplier once. World/NPC picking never
 * inherits that player-only transform. All render and spatial consumers share
 * this conversion. Pivot fractions are
 * relative to these scaled bounds and need no second scale operation.
 */
export function entityVisualSize(
  visual: PixiSceneDefinition['visuals']['entities'][number],
  role: 'world' | 'player' = 'world',
) {
  const playerScale = role === 'player' ? visual.playerScale ?? 1 : 1;
  return Object.freeze({
    width: visual.nativeSize.width * (visual.scale ?? 1) * (visual.axisScale?.x ?? 1) * playerScale,
    height: visual.nativeSize.height * (visual.scale ?? 1) * (visual.axisScale?.y ?? 1) * playerScale,
  });
}
