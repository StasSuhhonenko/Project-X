/** Source-symbol geometry shared by simulation collision and presentation.
 * Matrices map image pixels through authored registration into world units;
 * camera zoom and display interpolation are renderer-only operations. */
import type { SpecialEffectGeometry } from './combat-geometry';
import type { SpecialEffectState } from '../model/special-effect-state';
type Matrix = readonly [number, number, number, number, number, number];
type Layer = SpecialEffectGeometry['layers'][number];
export interface EffectBounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}
/** AVM1 alpha writes truncate to signed 8.8; quantize every debit. */
export function quantizeEffectAlpha(value: number, quantum: number): number {
  return quantum === 0 ? value : Math.floor(value / quantum) * quantum;
}
/** Nested timeline cadence is independent of the outer pulse. Transparent
 * static children can retain collision bounds after their ink disappears. */
export function specialEffectAppearance(effect: SpecialEffectState, visual: SpecialEffectGeometry) {
  const inner = visual.innerAnimation;
  const steps = inner && effect.ageTicks >= inner.firstStepAgeTick
    ? Math.floor((effect.ageTicks - inner.firstStepAgeTick) / inner.stepEveryTicks) + 1 : 0;
  let innerAlpha = inner?.initialAlphaPercent ?? 100;
  if (inner && steps > 0) {
    const quantum = inner.alphaQuantumPercent;
    const firstAlpha = quantizeEffectAlpha(inner.initialAlphaPercent - inner.fadePerTick, quantum);
    const debit = quantum === 0 ? inner.fadePerTick : Math.ceil(inner.fadePerTick / quantum) * quantum;
    innerAlpha = firstAlpha - (steps - 1) * debit;
  }
  return Object.freeze({
    scale: effect.kind === 'pulse' ? effect.scalePercent / 100 : 1,
    innerScale: inner ? (inner.initialScalePercent + inner.growthPerTick * steps) / 100 : 1,
    alpha: (effect.kind === 'pulse' ? effect.alphaPercent / 100 : 1) * Math.max(0, innerAlpha) / 100,
    visible: !inner || !inner.removeBelowAlphaAffectsBounds || innerAlpha >= inner.minimumAlphaPercent,
  });
}
/** Content validation orders poses; the latest applicable pose owns the ink. */
export function specialEffectLayers(effect: SpecialEffectState, visual: SpecialEffectGeometry): readonly Layer[] {
  const age = effect.ageTicks % (visual.frameCycleTicks ?? 1);
  return visual.poses?.reduce<readonly Layer[]>((layers, pose) =>
    pose.firstAgeTick <= age ? pose.layers : layers, visual.layers) ?? visual.layers;
}
function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
/** Image pixel coordinates to world coordinates. Rotation uses the authored
 * parent-local pivot, then nested animation/placement, then outer scaling. */
export function specialEffectLayerMatrix(effect: SpecialEffectState, visual: SpecialEffectGeometry, layer: Layer): Matrix {
  const appearance = specialEffectAppearance(effect, visual);
  const angle = (layer.rotationDegreesPerTick ?? 0) * effect.ageTicks * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle), pivot = layer.rotationPivot ?? { x: 0, y: 0 };
  const rotation: Matrix = [cos, sin, -sin, cos,
    pivot.x * (1 - cos) + pivot.y * sin, pivot.y * (1 - cos) - pivot.x * sin];
  const inner: Matrix = multiply(visual.innerTransform ?? [1, 0, 0, 1, 0, 0],
    [appearance.innerScale, 0, 0, appearance.innerScale, 0, 0]);
  const outer: Matrix = [appearance.scale, 0, 0, appearance.scale, effect.origin.x, effect.origin.y];
  const matrix = multiply(outer, multiply(inner, multiply(rotation, layer.transform)));
  if (!matrix.every(Number.isFinite)) throw Error('Special geometry overflow.');
  return matrix;
}
/** Bounds use fractional authored source crops rather than padded SVG canvases. */
export function specialEffectBounds(effect: SpecialEffectState, visual: SpecialEffectGeometry): EffectBounds | null {
  if (!specialEffectAppearance(effect, visual).visible) return null;
  const points = specialEffectLayers(effect, visual).flatMap(layer => {
    const [a, b, c, d, tx, ty] = specialEffectLayerMatrix(effect, visual, layer);
    const box = layer.bounds;
    return [[box.left, box.top], [box.right, box.top], [box.right, box.bottom], [box.left, box.bottom]]
      .map(([x, y]) => ({ x: a * x! + c * y! + tx, y: b * x! + d * y! + ty }));
  });
  if (!points.length || !points.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y))) throw Error('Invalid special geometry.');
  return {
    left: Math.min(...points.map(point => point.x)), right: Math.max(...points.map(point => point.x)),
    top: Math.min(...points.map(point => point.y)), bottom: Math.max(...points.map(point => point.y)),
  };
}
