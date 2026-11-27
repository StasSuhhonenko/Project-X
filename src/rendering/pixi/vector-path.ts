/** Pixi tracing of renderer-neutral vector paths (`shared/vector-path.ts`). */
import type { Graphics } from 'pixi.js';
import type { VectorPath } from '../shared/vector-path';

/**
 * Append one path to the current Graphics path, mapping local points through
 * `map`. The path is left open: a filled contour calls `closePath()` itself,
 * a stroked line does not.
 */
export function traceVectorPath(
  graphics: Graphics,
  path: VectorPath,
  map: (point: readonly [number, number]) => [number, number] = ([x, y]) => [x, y]
): void {
  graphics.moveTo(...map(path.start));
  path.segments.forEach(segment => {
    const to = map(segment.to);
    if (!segment.control) {
      graphics.lineTo(...to);
      return;
    }
    graphics.quadraticCurveTo(...map(segment.control), ...to);
  });
}
