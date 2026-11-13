/** BM1 source-stage geometry, independent of the browser and renderer.
 * The player registration and world zoom pivot are deliberately distinct.
 * Inputs/outputs use logical source pixels (world units before camera zoom).
 */
import type { Position } from '@engine/simulation/model/entity-components';

export const PLAYER_STAGE_ANCHOR = Object.freeze({ x: 298.6, y: 195.5 });
const WORLD_ZOOM_PIVOT = Object.freeze({ x: 298, y: 195 });

/** Displayed AABB extents of a centred hull after rotation and camera zoom.
 * Surface contact and ship boarding share this source hitTest approximation. */
export function rotatedHullBounds(width: number, height: number, headingDegrees: number, zoom: number) {
  const radians = (headingDegrees * Math.PI) / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  return { width: (width * cosine + height * sine) / zoom, height: (width * sine + height * cosine) / zoom };
}

/** Camera's linear inverse for a world-space vector. Range comparisons use
 * vectors to avoid pivot-cancellation rounding at strict source boundaries. */
export function worldOffsetToSourceStage(offset: Position, zoom: number): Position {
  return { x: offset.x / zoom, y: offset.y / zoom };
}

/** Recover the source screen position consumed by range/planet-panel tests. */
export function worldToSourceStage(position: Position, player: Position, zoom: number): Position {
  const delta = worldOffsetToSourceStage(
    {
      x: position.x - player.x + PLAYER_STAGE_ANCHOR.x - WORLD_ZOOM_PIVOT.x,
      y: position.y - player.y + PLAYER_STAGE_ANCHOR.y - WORLD_ZOOM_PIVOT.y,
    },
    zoom
  );
  return {
    x: WORLD_ZOOM_PIVOT.x + delta.x,
    y: WORLD_ZOOM_PIVOT.y + delta.y,
  };
}

/** Invert authored createship stage coordinates, preserving arithmetic order. */
export function sourceStageToWorld(position: Position, player: Position, zoom: number): Position {
  return {
    x: player.x + (position.x - WORLD_ZOOM_PIVOT.x) * zoom - PLAYER_STAGE_ANCHOR.x + WORLD_ZOOM_PIVOT.x,
    y: player.y + (position.y - WORLD_ZOOM_PIVOT.y) * zoom - PLAYER_STAGE_ANCHOR.y + WORLD_ZOOM_PIVOT.y,
  };
}
