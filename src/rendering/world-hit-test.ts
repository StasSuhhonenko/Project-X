/** Pure pointer hit testing over the current world and reviewed visual bounds. */
import type { GameModuleDefinition } from '../content/schemas/game-module';
import {
  selectPlayerEntity,
  selectSelectableWorldEntities,
  type WorldState,
} from '../simulation/model/world-state';
import { screenToWorld } from './world-camera';

interface Point { readonly x: number; readonly y: number }

/**
 * Select the topmost NPC or station under a logical viewport point. The target ID is
 * a world entity ID, never a Pixi object or a legacy dynamic clip path.
 * Planet hailing and player self-selection are separate interactions.
 */
export function pickWorldTarget(
  screenPoint: Point, world: WorldState, definition: GameModuleDefinition,
): string | null {
  const { viewport } = definition;
  if (!Number.isFinite(screenPoint.x) || !Number.isFinite(screenPoint.y)) return null;
  if (screenPoint.x < 0 || screenPoint.y < 0
      || screenPoint.x > viewport.width || screenPoint.y > viewport.height) return null;
  const point = screenToWorld(screenPoint, selectPlayerEntity(world).location.position, viewport, world.cameraZoom);
  const candidates = Array.from(selectSelectableWorldEntities(world)).reverse();
  const target = candidates.find(entity => {
    const visual = definition.visuals.entities.find(mapping => mapping.entityDefinitionId === entity.definitionId);
    if (!visual) throw new Error(`Selectable entity ${entity.id} has no visual mapping.`);
    const offsetX = point.x - entity.location.position.x;
    const offsetY = point.y - entity.location.position.y;
    const angle = entity.location.rotationDegrees * Math.PI / 180;
    const localX = offsetX * Math.cos(angle) + offsetY * Math.sin(angle);
    const localY = -offsetX * Math.sin(angle) + offsetY * Math.cos(angle);
    return localX >= -visual.pivot.x * visual.nativeSize.width
      && localX <= (1 - visual.pivot.x) * visual.nativeSize.width
      && localY >= -visual.pivot.y * visual.nativeSize.height
      && localY <= (1 - visual.pivot.y) * visual.nativeSize.height;
  });
  return target?.id ?? null;
}
