/**
 * BM1 warp/impulse classification, shared by navigation and travel arrival.
 *
 * Provenance: `Symbol-2-6202.as` navigation. Flash treats a speed below
 * `-25/zoom` as warp. Speeds are signed per-frame values, negative forward.
 */
export const WARP_THRESHOLD_PER_FRAME = -25;

/**
 * A ship whose authored maximum never exceeds native warp speed remains an
 * impulse craft at every camera scale (accepted user-requested guard; the
 * source's zoom arithmetic alone would label a zoomed-out Saber as warping).
 */
export function canWarp(maximumSpeedPerFrame: number): boolean {
  return maximumSpeedPerFrame > -WARP_THRESHOLD_PER_FRAME;
}

/** Classify a signed speed at the retained camera zoom denominator. */
export function flightModeAt(speedPerFrame: number, maximumSpeedPerFrame: number, zoom: number): 'warp' | 'impulse' {
  return canWarp(maximumSpeedPerFrame) && speedPerFrame < WARP_THRESHOLD_PER_FRAME / zoom ? 'warp' : 'impulse';
}
