import { equipmentArmaments } from '../simulation/model/equipment-state';
/** View-owned presentation of an accepted player beam shot. */
import { Matrix, Sprite, type Texture } from 'pixi.js';
import type { GameModuleDefinition } from '../content/schemas/game-module';
import { selectPlayerEntity, type WorldState } from '../simulation/model/world-state';
import type { PresentationTransform, TransformHistory } from './transform-history';
import { worldToScreen } from './world-camera';
import { triangularOffset } from './cosmetic-scatter';

type BeamVisual = GameModuleDefinition['visuals']['weaponBeams'][number];
type Viewport = GameModuleDefinition['viewport'];

interface ActiveBeam {
  readonly targetEntityId: string;
  readonly expiresAfterTick: number;
  readonly startedAtTick: number;
  readonly fallbackOrigin: PresentationTransform;
  readonly fallbackTarget: PresentationTransform;
  readonly impactOffset: Readonly<{ x: number; y: number }>;
}

export interface PlayerBeamEffect {
  readonly sprite: Sprite;
  /** All owned bitmap instances, in authored paint order. The first remains
   * available as sprite for single-image consumers. Parent disposal owns them. */
  readonly sprites: readonly Sprite[];
  /** Observe a committed world before its transform history advances. */
  advance(world: WorldState, history: TransformHistory): void;
  render(
    alpha: number,
    history: TransformHistory,
    trackedPlayer: PresentationTransform,
    viewport: Viewport,
    zoom: number,
  ): void;
  /** Discard transient effects when presentation history is rebased. */
  reset(world: WorldState): void;
}

/**
 * Create reusable bitmap layers for the player's fixed primary weapon. Accepted
 * shots are presentation events derived from authoritative armament state;
 * this component never changes damage, energy, cooldowns, or targeting.
 */
export function createPlayerBeamEffect(
  visual: BeamVisual,
  texture: Texture,
  initialWorld: WorldState,
  textures: ReadonlyMap<string, Texture> = new Map(),
  channel = 0,
): PlayerBeamEffect {
  const sprite = new Sprite(texture);
  sprite.anchor.set(visual.pivot.x, visual.pivot.y);
  sprite.visible = false;
  const layerCount = Math.max(1, ...(visual.frames?.map(frame => frame.layers.length) ?? []));
  const sprites = Object.freeze([sprite, ...Array.from({ length: layerCount - 1 }, () => {
    const extra = new Sprite(texture);
    extra.visible = false;
    return extra;
  })]);
  const hide = () => sprites.forEach(bitmap => { bitmap.visible = false; });

  let lastObservedTick = initialWorld.tick;
  let currentTick = initialWorld.tick;
  let active: ActiveBeam | null = null;

  const reset = (world: WorldState): void => {
    lastObservedTick = world.tick;
    currentTick = world.tick;
    active = null;
    hide();
  };

  return {
    sprite,
    sprites,
    reset,
    advance: (world, history) => {
      currentTick = world.tick;
      const player = selectPlayerEntity(world);
      const shot = equipmentArmaments(player)[channel]?.lastAcceptedShot;
      if (!shot || shot.targetEntityId === null || shot.tick <= lastObservedTick) return;
      lastObservedTick = shot.tick;
      if (shot.weaponDefinitionId !== visual.weaponDefinitionId) return;

      // Capture the pre-advance target so a lethal shot remains visible even
      // though destruction settlement removes it from the committed world.
      const fallbackOrigin = history.sample(world.playerEntityId, 1);
      const fallbackTarget = history.sample(shot.targetEntityId, 1);
      if (!fallbackOrigin || !fallbackTarget) return;
      const scatterLimit = Math.ceil(visual.impactScatterWorldUnits);
      active = Object.freeze({
        targetEntityId: shot.targetEntityId,
        expiresAfterTick: shot.tick + visual.durationFrames - 1,
        startedAtTick: shot.tick,
        fallbackOrigin,
        fallbackTarget,
        impactOffset: Object.freeze({
          x: triangularOffset(shot.sequence, 0x1b873593, scatterLimit),
          y: triangularOffset(shot.sequence, 0x85ebca6b, scatterLimit),
        }),
      });
    },
    render: (alpha, history, trackedPlayer, viewport, zoom) => {
      if (!active || currentTick > active.expiresAfterTick) {
        hide();
        return;
      }
      const origin = history.sample(initialWorld.playerEntityId, alpha) ?? active.fallbackOrigin;
      const target = history.sample(active.targetEntityId, alpha) ?? active.fallbackTarget;
      const shiftedTarget = {
        ...target,
        x: target.x + active.impactOffset.x,
        y: target.y + active.impactOffset.y,
      };
      const start = worldToScreen(origin, trackedPlayer, viewport, zoom);
      const end = worldToScreen(shiftedTarget, trackedPlayer, viewport, zoom);
      const deltaX = end.x - start.x;
      const deltaY = end.y - start.y;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance === 0) {
        hide();
        return;
      }
      sprite.visible = true;
      if (visual.frames && visual.frameCycleTicks) {
        const phase = (currentTick - active.startedAtTick) % visual.frameCycleTicks;
        // Content validation guarantees a zero-age pose and ordered keyposes.
        const pose = visual.frames.filter(frame => frame.firstAgeTick <= phase).at(-1)!;
        const cos = deltaX / distance;
        const sin = deltaY / distance;
        const scaleX = distance / 100;
        const scaleY = 1 / zoom;
        sprites.forEach((bitmap, index) => {
          const layer = pose.layers[index];
          if (!layer) {
            bitmap.visible = false;
            return;
          }
          const loaded = layer.image === visual.image ? texture : textures.get(layer.image);
          if (!loaded) throw Error('Beam bitmap layer was not preloaded.');
          const [a, b, c, d, tx, ty] = layer.bitmapTransform;
          bitmap.texture = loaded;
          bitmap.visible = true;
          bitmap.anchor.set(0, 0);
          // Compose parent distance/zoom/rotation with the complete authored
          // bitmap affine. Flattening it into width/height loses shear and the
          // relative registration of overlapping bitmap instances.
          bitmap.setFromMatrix(new Matrix(
            cos * scaleX * a - sin * scaleY * b, sin * scaleX * a + cos * scaleY * b,
            cos * scaleX * c - sin * scaleY * d, sin * scaleX * c + cos * scaleY * d,
            start.x + cos * scaleX * tx - sin * scaleY * ty,
            start.y + sin * scaleX * tx + cos * scaleY * ty,
          ));
        });
        return;
      }
      sprite.position.set(start.x, start.y);
      // Flash sets the parent clip's X scale to distance percent. The module's
      // recovered logical width includes the nested bitmap transform.
      sprite.width = distance * visual.logicalSize.width / 100;
      sprite.height = visual.logicalSize.height / zoom;
      sprite.rotation = Math.atan2(deltaY, deltaX);
    },
  };
}
