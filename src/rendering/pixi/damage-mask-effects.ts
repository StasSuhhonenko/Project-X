/**
 * Pixi presentation of the optional hull-damage mask.
 *
 * Each masked actor sprite gets one private `Graphics` used as its stencil
 * mask. The Graphics lives in the sprite's layer so it inherits the same
 * parent transform, and it copies the sprite's position, rotation and display
 * factor (camera zoom and any player-only scale) every frame. Its path is
 * rebuilt only when the selected frame changes, so steady flight costs one
 * transform copy per actor.
 *
 * Frame selection and placement rules belong to `shared/damage-mask.ts`; this
 * adapter owns only Pixi objects. Overlays drawn as separate sprites (shield
 * flash, beams, effects) are never masked, matching the legacy clip depth.
 */
import { Graphics, type Container, type Sprite } from 'pixi.js';
import type { DurabilityComponent } from '../../simulation/model/entity-components';
import type { WorldState } from '../../simulation/model/world-state';
import {
  damageMaskFrameNumber,
  damageMaskPercent,
  damageMaskPlacement,
  type DamageMaskContour,
  type DamageMaskSet,
} from '../shared/damage-mask';
import type { PixiSceneDefinition } from './configuration';
import { entityVisualSize } from './entity-visual-size';

type EntityVisual = PixiSceneDefinition['visuals']['entities'][number];

/** One actor sprite the view has already positioned for this display frame. */
export interface DamageMaskOwner {
  readonly entityId: string;
  readonly visual: EntityVisual;
  readonly sprite: Sprite;
  readonly role: 'world' | 'player';
}

export interface DamageMaskEffects {
  /** Re-derive every actor's frame from committed durability. */
  advance(world: WorldState): void;
  /** Attach or update masks; call after every owner sprite is final for this frame. */
  render(owners: readonly DamageMaskOwner[]): void;
  destroy(): void;
}

interface MaskEntry {
  readonly graphics: Graphics;
  readonly sprite: Sprite;
  drawnFrame: number;
}

/** Trace one contour into the current Graphics path, mapping local to host pixels. */
function tracePath(
  graphics: Graphics,
  contour: DamageMaskContour,
  map: (point: readonly [number, number]) => [number, number]
): void {
  graphics.moveTo(...map(contour.start));
  contour.segments.forEach(segment => {
    const to = map(segment.to);
    if (!segment.control) {
      graphics.lineTo(...to);
      return;
    }
    graphics.quadraticCurveTo(...map(segment.control), ...to);
  });
  graphics.closePath();
}

/** Rebuild a mask path for one frame: fill each outline, then cut its holes. */
function drawFrame(
  graphics: Graphics,
  set: DamageMaskSet,
  frameNumber: number,
  visual: EntityVisual,
  role: DamageMaskOwner['role']
) {
  const placement = damageMaskPlacement(set, frameNumber, entityVisualSize(visual, role));
  const map = ([x, y]: readonly [number, number]): [number, number] => [
    placement.originX + placement.scaleX * x,
    placement.originY + placement.scaleY * y,
  ];
  graphics.clear();
  set.frames[frameNumber - 1]!.regions.forEach(region => {
    tracePath(graphics, region.outline, map);
    graphics.fill(0xffffff);
    region.holes.forEach(hole => {
      tracePath(graphics, hole, map);
      graphics.cut();
    });
  });
}

/** Return null when the module declares no damage-mask policy. */
export function createDamageMaskEffects(
  initialWorld: WorldState,
  definition: PixiSceneDefinition,
  layer: Container
): DamageMaskEffects | null {
  const policy = definition.visuals.damageMask;
  if (!policy) return null;
  const maximumOf = (definitionId: number): DurabilityComponent | undefined => {
    const entity = definition.content.entityDefinitions.find(candidate => candidate.id === definitionId);
    if (entity?.category !== 'ship') return undefined;
    return { hull: entity.maximumHull, shields: entity.maximumShields };
  };
  let frames = new Map<string, number>();
  const entries = new Map<string, MaskEntry>();

  const advance = (world: WorldState): void => {
    frames = new Map(
      world.entities.flatMap(entity => {
        const set = entity.kind === 'player-ship' ? policy.player : policy.actors;
        const percent = set ? damageMaskPercent(entity, maximumOf) : null;
        if (!set || percent === null) return [];
        return [[entity.id, damageMaskFrameNumber(percent, set.frames.length, policy.percentPerFrame)] as const];
      })
    );
  };

  const release = (entityId: string): void => {
    const entry = entries.get(entityId);
    if (!entry) return;
    if (!entry.sprite.destroyed && entry.sprite.mask === entry.graphics) entry.sprite.mask = null;
    entry.graphics.destroy();
    entries.delete(entityId);
  };

  const render: DamageMaskEffects['render'] = owners => {
    const live = new Set(owners.map(owner => owner.entityId));
    [...entries.keys()].filter(id => !live.has(id)).forEach(release);
    owners.forEach(owner => {
      const set = owner.role === 'player' ? policy.player : policy.actors;
      const frame = frames.get(owner.entityId);
      if (!set || frame === undefined) {
        release(owner.entityId);
        return;
      }
      // A rebound actor may reuse an ID with a new sprite; never mask a stale one.
      if (entries.get(owner.entityId)?.sprite !== owner.sprite) release(owner.entityId);
      const entry = entries.get(owner.entityId) ?? createEntry(owner);
      if (entry.drawnFrame !== frame) {
        drawFrame(entry.graphics, set, frame, owner.visual, owner.role);
        entry.drawnFrame = frame;
      }
      const base = entityVisualSize(owner.visual, owner.role);
      const factorX = base.width !== 0 ? Math.abs(owner.sprite.width / base.width) : 0;
      const factorY = base.height !== 0 ? Math.abs(owner.sprite.height / base.height) : 0;
      entry.graphics.position.copyFrom(owner.sprite.position);
      entry.graphics.rotation = owner.sprite.rotation;
      entry.graphics.scale.set(factorX, factorY);
    });
  };

  const createEntry = (owner: DamageMaskOwner): MaskEntry => {
    const graphics = new Graphics();
    layer.addChild(graphics);
    owner.sprite.mask = graphics;
    const entry: MaskEntry = { graphics, sprite: owner.sprite, drawnFrame: 0 };
    entries.set(owner.entityId, entry);
    return entry;
  };

  advance(initialWorld);
  return Object.freeze({
    advance,
    render,
    destroy: () => [...entries.keys()].forEach(release),
  });
}
