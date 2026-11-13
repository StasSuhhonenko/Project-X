/** Inclusive displayed AABB basis of Page1:25841 planet.hitTest(player).
 * Numeric maintained geometry only; lengths are logical stage pixels after zoom.
 * Contact hail and surface policy share this owner, without standing gates. */
import type { SystemDefinition } from '@engine/content/schemas/game-module';
import type { Position } from '@engine/simulation/model/entity-components';
import { missionData } from './mission-data';
import { PLAYER_STAGE_ANCHOR, rotatedHullBounds, worldToSourceStage } from './source-geometry';

export function overlapsPlanet(
  system: SystemDefinition,
  relative: Position,
  player: Readonly<{ x: number; y: number; boundsWidth: number; boundsHeight: number; zoom: number }>
): boolean {
  const visual = missionData.planets.find(v => v.id === system.planet.visualTypeId);
  if (!visual) return false;
  const point = worldToSourceStage(relative, { x: 0, y: 0 }, player.zoom);
  const width = (visual.width * system.planet.displayScalePercent) / 100 / player.zoom;
  const height = (visual.height * system.planet.displayScalePercent) / 100 / player.zoom;
  return (
    point.x - visual.pivotX * width <= player.x + player.boundsWidth / 2 &&
    point.x + (1 - visual.pivotX) * width >= player.x - player.boundsWidth / 2 &&
    point.y - visual.pivotY * height <= player.y + player.boundsHeight / 2 &&
    point.y + (1 - visual.pivotY) * height >= player.y - player.boundsHeight / 2
  );
}

export function surfaceOverlap(
  system: SystemDefinition,
  playerDefinitionId: number,
  playerPosition: Position,
  planetPosition: Position,
  zoom: number,
  headingDegrees: number
): boolean {
  const visual = missionData.entities.find(v => v.id === playerDefinitionId);
  if (!visual) return false;
  const bounds = rotatedHullBounds(visual.width, visual.height, headingDegrees, zoom);
  return overlapsPlanet(
    system,
    { x: planetPosition.x - playerPosition.x, y: planetPosition.y - playerPosition.y },
    {
      ...PLAYER_STAGE_ANCHOR,
      zoom,
      boundsWidth: bounds.width,
      boundsHeight: bounds.height,
    }
  );
}
