/** BM1 source-stage geometry, independent of the browser and renderer.
 * The player registration and world zoom pivot are deliberately distinct.
 * Inputs/outputs use logical source pixels (world units before camera zoom).
 */
import type { Position } from '../../src/simulation/model/entity-components';

export const PLAYER_STAGE_ANCHOR = Object.freeze({ x: 298.6, y: 195.5 });
const WORLD_ZOOM_PIVOT = Object.freeze({ x: 298, y: 195 });

/** Recover the source screen position consumed by range/planet-panel tests. */
export function worldToSourceStage(position: Position, player: Position, zoom: number): Position {
  return {
    x: WORLD_ZOOM_PIVOT.x + (position.x - player.x + PLAYER_STAGE_ANCHOR.x - WORLD_ZOOM_PIVOT.x) / zoom,
    y: WORLD_ZOOM_PIVOT.y + (position.y - player.y + PLAYER_STAGE_ANCHOR.y - WORLD_ZOOM_PIVOT.y) / zoom,
  };
}

/** Invert authored createship stage coordinates, preserving arithmetic order. */
export function sourceStageToWorld(position: Position, player: Position, zoom: number): Position {
  return {
    x: player.x + (position.x - WORLD_ZOOM_PIVOT.x) * zoom - PLAYER_STAGE_ANCHOR.x + WORLD_ZOOM_PIVOT.x,
    y: player.y + (position.y - WORLD_ZOOM_PIVOT.y) * zoom - PLAYER_STAGE_ANCHOR.y + WORLD_ZOOM_PIVOT.y,
  };
}
