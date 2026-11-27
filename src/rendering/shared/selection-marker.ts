/**
 * View-owned selection marker: a renderer-neutral policy schema plus pure
 * helpers for its size and pulse.
 *
 * The marker is drawn over the selected world target at the target's
 * registration point. It reads the same `selectedTargetEntityId` as the
 * target panel and is never saved: a load or scene rebind simply starts a new
 * marker for the restored selection.
 *
 * Units and spaces:
 * - Stroke points and `bounds` are marker-local pixels around the marker's
 *   registration point (the point placed on the target).
 * - The marker is scaled uniformly about that point; stroke widths scale with
 *   it, as a scaled vector clip's lines do.
 * - `alphaByFrame` is indexed by elapsed presentation frames at the module's
 *   `framesPerSecond`, counted from the moment the marker appeared.
 *
 * A module that omits the policy gets the engine's neutral placeholder ring.
 */
import { z } from 'zod';
import { VectorBoundsSchema, vectorPathSchema } from './vector-path';

const Rgb = z.number().int().min(0).max(0xffffff);

export const SelectionMarkerAppearanceSchema = z
  .object({
    /** Open stroked paths, drawn in order. */
    strokes: z
      .array(
        z
          .object({
            path: vectorPathSchema(1),
            /** Line width in marker-local pixels before marker scaling. */
            widthPixels: z.number().finite().positive().max(16),
            color: Rgb,
          })
          .strict()
          .readonly()
      )
      .min(1)
      .max(64)
      .readonly(),
    /** Local envelope fitted to the measured target size on both axes. */
    bounds: VectorBoundsSchema,
    /**
     * `mean-displayed-extent-at-selection`: when the marker appears, measure
     * the target's displayed axis-aligned width and height (rotation and
     * camera zoom included) and fit `bounds` to their mean on both axes. The
     * size is kept for the marker's lifetime; a later zoom or turn does not
     * refit it.
     */
    sizing: z.literal('mean-displayed-extent-at-selection'),
    /** Opacity cycle (0..1), one entry per presentation frame, repeating. */
    alphaByFrame: z.array(z.number().finite().min(0).max(1)).min(1).max(240).readonly(),
  })
  .strict()
  .readonly();
export type SelectionMarkerAppearance = z.infer<typeof SelectionMarkerAppearanceSchema>;

/**
 * Displayed axis-aligned extent of a rotated box: unrotated `width`/`height`
 * in world pixels at zoom one, `rotationDegrees` clockwise, divided by the
 * camera zoom denominator.
 */
export function displayedExtent(
  size: Readonly<{ width: number; height: number }>,
  rotationDegrees: number,
  cameraZoom: number
): Readonly<{ width: number; height: number }> {
  const radians = (rotationDegrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const width = Math.abs(size.width);
  const height = Math.abs(size.height);
  return Object.freeze({
    width: (width * cos + height * sin) / cameraZoom,
    height: (width * sin + height * cos) / cameraZoom,
  });
}

/** Uniform marker scale that fits `bounds` to the mean of the displayed extent. */
export function selectionMarkerScale(
  appearance: SelectionMarkerAppearance,
  extent: Readonly<{ width: number; height: number }>
): Readonly<{ x: number; y: number }> {
  const size = (extent.width + extent.height) / 2;
  const { bounds } = appearance;
  return Object.freeze({ x: size / (bounds.right - bounds.left), y: size / (bounds.bottom - bounds.top) });
}

/** Opacity after `elapsedMs` of presentation time; frame 0 is the first entry. */
export function selectionMarkerAlpha(
  appearance: SelectionMarkerAppearance,
  elapsedMs: number,
  framesPerSecond: number
): number {
  const cycle = appearance.alphaByFrame;
  const frame = Math.max(0, Math.floor((elapsedMs * framesPerSecond) / 1000));
  return cycle[frame % cycle.length]!;
}
