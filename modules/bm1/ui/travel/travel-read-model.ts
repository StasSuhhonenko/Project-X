/** Source-qualified formatting observes host facts; it never prices or commits. */
import type { GameplayPresentationProps } from '../../presentation-contract';
import { viewportContent } from '../viewport/viewport-content';
import { TRAVEL_DEPARTURE_DURATION_MS } from './travel-content';

export type TravelFacts = NonNullable<GameplayPresentationProps['travel']>;

/** Original report intentionally displays the unrounded route distance while
 * simulation separately advances the whole-day count. Do not add unimplemented
 * income, attacks, autosave messages or an extra terminal period. */
export function travelReport(travel: TravelFacts): string {
  return `${travel.durationDays} days have passed. The current stardate is now ${travel.arrivalDate.major}.${travel.arrivalDate.minor}.\n\nYour ship has consumed ${travel.fuelUnits} tons of antimatter`;
}

/** Display-rate sampling of compiled tween frames. Only adjacent samples of the
 * same character interpolate: ship10 never morphs into flash11, and frame16
 * retains its authored hold. Matrices use logical pixels; alpha is0..1. */
export function departureTween(elapsedMs: number) {
  if (!Number.isFinite(elapsedMs) || elapsedMs >= TRAVEL_DEPARTURE_DURATION_MS) return null;
  const position = (Math.max(0, elapsedMs) * 13) / 1000;
  const index = Math.min(17, Math.floor(position));
  const from = viewportContent.warp[index]!;
  const to = viewportContent.warp[Math.min(17, index + 1)]!;
  const mix = from.kind === to.kind ? position - index : 0;
  const lerp = (a: number, b: number) => a + (b - a) * mix;
  return {
    frame: from.frame,
    kind: from.kind,
    alpha: lerp(from.alpha, to.alpha),
    matrix: {
      a: lerp(from.matrix.a, to.matrix.a),
      b: lerp(from.matrix.b, to.matrix.b),
      c: lerp(from.matrix.c, to.matrix.c),
      d: lerp(from.matrix.d, to.matrix.d),
      tx: lerp(from.matrix.tx, to.matrix.tx),
      ty: lerp(from.matrix.ty, to.matrix.ty),
    },
  };
}
