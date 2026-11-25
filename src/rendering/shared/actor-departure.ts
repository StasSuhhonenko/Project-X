/**
 * View-only warp-out artwork for an actor that is leaving the system.
 *
 * The simulation owns only `npc-ship.departure.elapsedTicks` (see
 * `simulation/features/departure.ts`); this module turns that count into one
 * artwork sample. A module publishes the samples it recovered from its own
 * source; omitting the policy leaves a departing actor drawn as it was until
 * its removal. Saves never contain presentation state.
 *
 * Coordinate contract for every frame:
 * - The frame describes a transform of the actor's registration in its own
 *   unrotated frame (the engine's "clockwise degrees from up" convention, so
 *   the nose points toward −y). The view then applies the actor's rotation,
 *   its world position and the camera zoom, as for the ordinary sprite.
 * - `x`/`y` are logical pixels at zoom 1; `scaleX`/`scaleY` are unitless
 *   multipliers applied about the drawn artwork's registration.
 * - `kind: 'actor'` stretches the actor's own artwork; `kind: 'flash'` hides it
 *   and draws the policy's `flash` bitmap instead.
 * - `alpha` multiplies the actor's existing opacity (for example a cloak fade).
 */
import { z } from 'zod';
import { MAXIMUM_DEPARTURE_TICKS } from '../../simulation/model/npc-state';
import { RegisteredArtworkSchema } from './shield-flash';

const FiniteNumber = z.number().finite();

export const ActorDepartureFrameSchema = z
  .object({
    kind: z.enum(['actor', 'flash']),
    scaleX: FiniteNumber.positive().max(100),
    scaleY: FiniteNumber.positive().max(100),
    x: FiniteNumber.min(-10000).max(10000),
    y: FiniteNumber.min(-10000).max(10000),
    alpha: FiniteNumber.min(0).max(1),
  })
  .strict()
  .readonly();
export type ActorDepartureFrame = z.infer<typeof ActorDepartureFrameSchema>;

export const ActorDepartureAppearanceSchema = z
  .object({
    /** One sample per elapsed departure tick, starting with the deciding tick.
     * A departure that outlasts the list holds its final sample. */
    frames: z.array(ActorDepartureFrameSchema).min(1).max(MAXIMUM_DEPARTURE_TICKS).readonly(),
    /** Required exactly when any frame draws the flash. */
    flash: RegisteredArtworkSchema.optional(),
  })
  .strict()
  .superRefine((appearance, context) => {
    const usesFlash = appearance.frames.some(frame => frame.kind === 'flash');
    if (usesFlash !== (appearance.flash !== undefined))
      context.addIssue({ code: 'custom', path: ['flash'], message: 'Flash artwork must match flash frames.' });
  })
  .readonly();
export type ActorDepartureAppearance = z.infer<typeof ActorDepartureAppearanceSchema>;

/**
 * Sample the artwork drawn `alpha` of the way through the interval that ended
 * with the committed `elapsedTicks`. As for the player's own warp tween, only
 * adjacent samples of the same kind interpolate: the hull never morphs into
 * the flash, and an authored hold (two equal samples) stays still.
 * On the deciding tick (`elapsedTicks` 0) the interval starts from the
 * ordinary actor, so the first sample is shown without interpolation.
 */
export function sampleActorDeparture(
  appearance: ActorDepartureAppearance,
  elapsedTicks: number,
  alpha: number
): ActorDepartureFrame {
  const last = appearance.frames.length - 1;
  const position = Math.min(last, Math.max(0, elapsedTicks - 1 + Math.min(1, Math.max(0, alpha))));
  const index = Math.floor(position);
  const from = appearance.frames[index]!;
  const to = appearance.frames[Math.min(last, index + 1)]!;
  const mix = from.kind === to.kind ? position - index : 0;
  const lerp = (a: number, b: number) => a + (b - a) * mix;
  return Object.freeze({
    kind: from.kind,
    scaleX: lerp(from.scaleX, to.scaleX),
    scaleY: lerp(from.scaleY, to.scaleY),
    x: lerp(from.x, to.x),
    y: lerp(from.y, to.y),
    alpha: lerp(from.alpha, to.alpha),
  });
}
