/** Read-only timeline preparation and renderer-independent affine sampling. */
import type { ConstructionSiteVisual } from '../../content/schemas/game-module';
import { interpolateRotation } from './transform-history';

type ConstructionAnimation = NonNullable<ConstructionSiteVisual['animation']>;
type Keyframe = ConstructionAnimation['layers'][number]['keyframes'][number];
type Placement = Keyframe['samples'][number][number];
type AffineMatrix = Placement['matrix'];
export type AffineMatrixBuffer = [...AffineMatrix];

type AxisInterpolation = Readonly<{
  length: number;
  lengthDelta: number;
  angleRadians: number;
  angleDeltaRadians: number;
}>;

type AffineInterpolation = Readonly<{
  from: AffineMatrix;
  to: AffineMatrix;
  x: AxisInterpolation;
  y: AxisInterpolation;
}>;

const RADIANS_PER_DEGREE = Math.PI / 180;

function prepareAxis(fromX: number, fromY: number, toX: number, toY: number): AxisInterpolation {
  const length = Math.hypot(fromX, fromY);
  const nextLength = Math.hypot(toX, toY);
  // A collapsed axis has no direction. Borrow the visible endpoint's angle.
  const angle = length === 0 ? Math.atan2(toY, toX) : Math.atan2(fromY, fromX);
  const nextAngle = nextLength === 0 ? angle : Math.atan2(toY, toX);
  const angleDegrees = angle / RADIANS_PER_DEGREE;
  const endDegrees = interpolateRotation(angleDegrees, nextAngle / RADIANS_PER_DEGREE, 1);
  return {
    length,
    lengthDelta: nextLength - length,
    angleRadians: angle,
    angleDeltaRadians: (endDegrees - angleDegrees) * RADIANS_PER_DEGREE,
  };
}

/** Each matrix column is an independent axis vector. Its angle preserves skew
 * and reflection without an extra scale-sign convention. */
export function prepareAffineInterpolation(from: AffineMatrix, to: AffineMatrix): AffineInterpolation {
  return { from, to, x: prepareAxis(from[0], from[1], to[0], to[1]), y: prepareAxis(from[2], from[3], to[2], to[3]) };
}

/** Independent axis arcs can make the axes pass through each other although
 * both endpoints have the same handedness, so the artwork would collapse and
 * mirror mid-interval. The determinant is proportional to the sine of the
 * y-axis angle relative to the x axis, and that relative angle changes
 * linearly. It must not cross a multiple of pi strictly inside the interval.
 * A degenerate endpoint (an exact multiple) is allowed. */
function keepsOrientation({ x, y }: AffineInterpolation): boolean {
  const start = y.angleRadians - x.angleRadians;
  const end = start + y.angleDeltaRadians - x.angleDeltaRadians;
  const low = Math.min(start, end);
  const high = Math.max(start, end);
  return (Math.floor(low / Math.PI) + 1) * Math.PI >= high;
}

/** Sample a unitless fraction of one authored interval. Endpoints return the
 * exact input tuples. An interior result borrows caller-owned scratch storage
 * and is valid until that storage is reused. Translation retains input units. */
export function interpolateAffineMatrix(
  { from, to, x, y }: AffineInterpolation,
  fraction: number,
  output: AffineMatrixBuffer
): AffineMatrix {
  if (fraction <= 0) return from;
  if (fraction >= 1) return to;
  const xLength = x.length + x.lengthDelta * fraction;
  const yLength = y.length + y.lengthDelta * fraction;
  const xAngle = x.angleRadians + x.angleDeltaRadians * fraction;
  const yAngle = y.angleRadians + y.angleDeltaRadians * fraction;
  output[0] = Math.cos(xAngle) * xLength;
  output[1] = Math.sin(xAngle) * xLength;
  output[2] = Math.cos(yAngle) * yLength;
  output[3] = Math.sin(yAngle) * yLength;
  output[4] = (1 - fraction) * from[4] + fraction * to[4];
  output[5] = (1 - fraction) * from[5] + fraction * to[5];
  return output;
}

type PreparedPlacement = Readonly<{ placement: Placement; blend?: AffineInterpolation }>;
type LayerFrame = Readonly<{ slots: readonly PreparedPlacement[]; blends: boolean }>;
type PreparedLayer = Readonly<{ frames: readonly LayerFrame[]; slotCount: number }>;

/** Flatten validated, equal-length layers without losing each sample's outgoing
 * tween kind. Layer and slot order remain back to front. Prepare all eligible
 * intervals once so sampling needs no adjacency checks or axis decomposition. */
export function prepareConstructionTimeline(animation: ConstructionAnimation): Readonly<{
  layers: readonly PreparedLayer[];
  blendingFrames: readonly boolean[];
}> {
  const layers = animation.layers.map(({ keyframes }) => {
    const samples = keyframes.flatMap(keyframe =>
      Array.from({ length: keyframe.duration }, (_, index) => ({
        tweenKind: keyframe.tweenKind,
        placements: keyframe.samples[keyframe.tweenKind === 'none' ? 0 : index]!,
      }))
    );
    const frames = samples.map(({ tweenKind, placements }, index) => {
      // Motion can cross a keyframe boundary, but the loop cut is authored.
      // Shape samples are discrete artwork. Matching paths cannot describe a morph.
      const next = tweenKind === 'motion' ? samples[index + 1]?.placements : undefined;
      const slots = placements.map((placement, slot): PreparedPlacement => {
        const target = next?.[slot];
        if (target?.image !== placement.image) return { placement };
        if (placement.matrix.every((value, component) => value === target.matrix[component])) return { placement };
        const blend = prepareAffineInterpolation(placement.matrix, target.matrix);
        // Such an interval stays stepped rather than inventing a mirrored pose.
        return keepsOrientation(blend) ? { placement, blend } : { placement };
      });
      return { slots, blends: slots.some(slot => slot.blend !== undefined) };
    });
    return { frames, slotCount: Math.max(...frames.map(frame => frame.slots.length)) };
  });
  const blendingFrames = layers[0]!.frames.map((_, index) => layers.some(layer => layer.frames[index]!.blends));
  return { layers, blendingFrames };
}
