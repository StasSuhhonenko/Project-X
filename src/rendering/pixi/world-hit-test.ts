/** Pure pointer hit testing over the current world and reviewed visual bounds. */
import type { PixiSceneDefinition as GameModuleDefinition } from './configuration';
import { entityVisualSize } from '../pixi/entity-visual-size';
import {
  selectPlayerEntity,
  selectSelectableWorldEntities,
  type WorldState,
} from '../../simulation/model/world-state';
import { screenToWorld } from '../shared/world-camera';
import type { PresentationTransform } from '../shared/transform-history';

interface Point { readonly x: number; readonly y: number }

/** View-owned samples from the last drawn frame, never authoritative state. */
export interface PresentedTargetFrame {
  readonly player: Point;
  readonly zoom: number;
  readonly transforms: ReadonlyMap<string, PresentationTransform>;
  readonly planet?: PresentationTransform;
}

/** One pointer activation over displayed ink. Planets are contact surfaces,
 * never combat selections; actors above the planet retain picking priority. */
export function pickWorldContact(screenPoint: Point, world: WorldState, definition: GameModuleDefinition,
  frame?: PresentedTargetFrame): { readonly id: string; readonly kind: 'planet' | 'station' | 'npc-ship' } | null {
  const targetId = pickWorldTarget(screenPoint, world, definition, frame);
  const target = world.entities.find(entity => entity.id === targetId);
  if (target && (target.kind === 'station' || target.kind === 'npc-ship')) return { id: target.id, kind: target.kind };
  if (!Number.isFinite(screenPoint.x) || !Number.isFinite(screenPoint.y)
    || screenPoint.x < 0 || screenPoint.y < 0 || screenPoint.x > definition.viewport.width || screenPoint.y > definition.viewport.height) return null;
  const planet = world.entities.find(entity => entity.kind === 'planet');
  if (!planet) return null;
  const transform = frame ? frame.planet : planet.location.position;
  if (!transform) return null;
  const system = definition.systems.find(system => system.id === planet.location.systemId);
  const visual = definition.visuals.planets.find(visual => visual.visualTypeId === system?.planet.visualTypeId);
  if (!system || !visual) return null;
  const point = screenToWorld(screenPoint, frame?.player ?? selectPlayerEntity(world).location.position,
    definition.viewport, frame?.zoom ?? world.cameraZoom);
  const width = visual.nativeSize.width * system.planet.displayScalePercent / 100;
  const height = visual.nativeSize.height * system.planet.displayScalePercent / 100;
  if (point.x < transform.x - visual.pivot.x * width || point.x > transform.x + (1 - visual.pivot.x) * width
    || point.y < transform.y - visual.pivot.y * height || point.y > transform.y + (1 - visual.pivot.y) * height) return null;
  return { id: planet.id, kind: 'planet' };
}

/**
 * Select the topmost NPC or station under a logical viewport point. The target ID is
 * a world entity ID, never a Pixi object or a legacy dynamic clip path.
 * Planet hailing and player self-selection are separate interactions.
 */
export function pickWorldTarget(
  screenPoint: Point, world: WorldState, definition: GameModuleDefinition,
  frame?: PresentedTargetFrame,
): string | null {
  const { viewport } = definition;
  if (!Number.isFinite(screenPoint.x) || !Number.isFinite(screenPoint.y)) return null;
  if (screenPoint.x < 0 || screenPoint.y < 0
      || screenPoint.x > viewport.width || screenPoint.y > viewport.height) return null;
  const point = screenToWorld(screenPoint, frame?.player ?? selectPlayerEntity(world).location.position,
    viewport, frame?.zoom ?? world.cameraZoom);
  const candidates = Array.from(selectSelectableWorldEntities(world)).reverse();
  const target = candidates.find(entity => {
    // Current membership remains authoritative: a stale visible frame cannot
    // select a removed actor, and a not-yet-drawn actor has no pickable bounds.
    const transform = frame ? frame.transforms.get(entity.id) : {
      ...entity.location.position, rotationDegrees: entity.location.rotationDegrees,
    };
    if (!transform) return false;
    const visual = definition.visuals.entities.find(mapping => mapping.entityDefinitionId === entity.definitionId);
    if (!visual) throw new Error(`Selectable entity ${entity.id} has no visual mapping.`);
    const offsetX = point.x - transform.x;
    const offsetY = point.y - transform.y;
    const angle = transform.rotationDegrees * Math.PI / 180;
    const localX = offsetX * Math.cos(angle) + offsetY * Math.sin(angle);
    const localY = -offsetX * Math.sin(angle) + offsetY * Math.cos(angle);
    const size = entityVisualSize(visual);
    return localX >= -visual.pivot.x * size.width
      && localX <= (1 - visual.pivot.x) * size.width
      && localY >= -visual.pivot.y * size.height
      && localY <= (1 - visual.pivot.y) * size.height;
  });
  return target?.id ?? null;
}
