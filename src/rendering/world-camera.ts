/** Pure camera projection; zoom is a denominator in logical screen pixels. */
import type { Position } from '../simulation/model/entity-components';

/** Translate a world position around a tracked point; never feeds back into simulation. */
export function worldToScreen(
  position: Position,
  trackedPosition: Position,
  viewport: Readonly<{
    width: number; height: number;
    cameraAnchor?: Readonly<{ x: number; y: number }> | undefined;
    zoom?: Readonly<{ levels?: readonly number[]; pivot?: Readonly<{ x: number; y: number }> | undefined }> | undefined;
  }>,
  zoom = 1,
): Position {
  const anchor = viewport.cameraAnchor ?? { x: viewport.width / 2, y: viewport.height / 2 };
  const pivot = viewport.zoom?.pivot ?? anchor;
  return {
    x: pivot.x + (position.x - trackedPosition.x + anchor.x - pivot.x) / zoom,
    y: pivot.y + (position.y - trackedPosition.y + anchor.y - pivot.y) / zoom,
  };
}

/** Inverse projection for pointer hit tests at the committed camera zoom. */
export function screenToWorld(
  screenPosition: Position,
  trackedPosition: Position,
  viewport: Parameters<typeof worldToScreen>[2],
  zoom = 1,
): Position {
  const anchor = viewport.cameraAnchor ?? { x: viewport.width / 2, y: viewport.height / 2 };
  const pivot = viewport.zoom?.pivot ?? anchor;
  return {
    x: trackedPosition.x + (screenPosition.x - pivot.x) * zoom - anchor.x + pivot.x,
    y: trackedPosition.y + (screenPosition.y - pivot.y) * zoom - anchor.y + pivot.y,
  };
}
