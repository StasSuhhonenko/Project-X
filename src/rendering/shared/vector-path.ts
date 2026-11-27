/**
 * Renderer-neutral vector paths authored by a module.
 *
 * A path is a start point followed by straight or quadratic segments, in the
 * owning visual's local pixels. Recovered Flash shape records use exactly this
 * form (straight and quadratic edges), so modules can publish them without
 * resampling. Whether a path is closed and filled (a damage-mask contour) or
 * open and stroked (a selection marker) is decided by the consumer.
 */
import { z } from 'zod';

const FiniteNumber = z.number().finite();
export const VectorPointSchema = z.tuple([FiniteNumber, FiniteNumber]).readonly();

/** Path schema with at least `minSegments` segments (closed contours need two). */
export function vectorPathSchema(minSegments: number) {
  return z
    .object({
      start: VectorPointSchema,
      segments: z
        .array(z.object({ to: VectorPointSchema, control: VectorPointSchema.optional() }).strict().readonly())
        .min(minSegments)
        .max(2000)
        .readonly(),
    })
    .strict()
    .readonly();
}
export type VectorPath = z.infer<ReturnType<typeof vectorPathSchema>>;

/** Non-empty local-pixel envelope used to fit a vector visual to a size. */
export const VectorBoundsSchema = z
  .object({ left: FiniteNumber, top: FiniteNumber, right: FiniteNumber, bottom: FiniteNumber })
  .strict()
  .refine(bounds => bounds.right > bounds.left && bounds.bottom > bounds.top, 'Vector bounds must be non-empty.')
  .readonly();
