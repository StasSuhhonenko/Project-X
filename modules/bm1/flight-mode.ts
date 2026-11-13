/**
 * BM1 warp/impulse classification, shared by navigation and travel arrival.
 *
 * Provenance: `Symbol-2-6202.as` navigation. Flash treats a speed below
 * `-25/zoom` as warp. Speeds are signed per-frame values, negative forward.
 */
export const WARP_THRESHOLD_PER_FRAME = -25;

/**
 * Forward speed change per held-accelerate frame before any warp boost
 * (`_root.speed -= 2`, `Symbol-2-6202.as:58-60`). Flash tests the maximum
 * before this step, so the last step may overshoot the authored maximum.
 */
export const IMPULSE_ACCELERATION_PER_FRAME = 2;

/**
 * Highest forward speed (positive) that held acceleration reaches from rest at
 * native zoom 1: the authored maximum rounded up to a whole acceleration step.
 */
function nativeTopSpeed(maximumSpeedPerFrame: number): number {
  if (maximumSpeedPerFrame <= 0) return 0;
  return Math.ceil(maximumSpeedPerFrame / IMPULSE_ACCELERATION_PER_FRAME) * IMPULSE_ACCELERATION_PER_FRAME;
}

/**
 * Whether a ship may enter local warp at all (accepted user-requested S7
 * guard). The source has no such guard: its zoomed threshold `-25/zoom` alone
 * would let a zoomed-out Saber (maximum 20) warp. The guard admits exactly the
 * ships that cross native warp at zoom 1 under the source step arithmetic, so a
 * maximum-25 ship (B'rel, Hideki) still overshoots −24 → −26 into warp as in the
 * original, while ships of maximum 24 or less remain impulse at every zoom.
 */
export function canWarp(maximumSpeedPerFrame: number): boolean {
  return nativeTopSpeed(maximumSpeedPerFrame) > -WARP_THRESHOLD_PER_FRAME;
}

/** Classify a signed speed at the retained camera zoom denominator. */
export function flightModeAt(speedPerFrame: number, maximumSpeedPerFrame: number, zoom: number): 'warp' | 'impulse' {
  return canWarp(maximumSpeedPerFrame) && speedPerFrame < WARP_THRESHOLD_PER_FRAME / zoom ? 'warp' : 'impulse';
}
