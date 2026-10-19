/** View-owned presentation of an accepted player beam shot. */
import { Sprite, type Texture } from 'pixi.js';
import type { GameModuleDefinition } from '../content/schemas/game-module';
import { selectPlayerEntity, type WorldState } from '../simulation/model/world-state';
import type { PresentationTransform, TransformHistory } from './transform-history';
import { worldToScreen } from './world-camera';

type BeamVisual = GameModuleDefinition['visuals']['weaponBeams'][number];
type Viewport = GameModuleDefinition['viewport'];

interface ActiveBeam {
  readonly targetEntityId: string;
  readonly expiresAfterTick: number;
  readonly fallbackOrigin: PresentationTransform;
  readonly fallbackTarget: PresentationTransform;
  readonly impactOffset: Readonly<{ x: number; y: number }>;
}

export interface PlayerBeamEffect {
  readonly sprite: Sprite;
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
 * Produce a stable visual-only substitute for Flash's unrecovered random stream.
 * Two independent draws retain the source's triangular `random(n)-random(n)`
 * distribution without consuming gameplay or star-field randomness.
 */
function triangularOffset(sequence: number, salt: number, limit: number): number {
  if (limit <= 0) return 0;
  const draw = (offset: number): number => {
    let value = (sequence ^ offset) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    return ((value ^ (value >>> 16)) >>> 0) % limit;
  };
  return draw(salt) - draw(salt ^ 0x9e3779b9);
}

/**
 * Create one reusable sprite for the player's fixed primary weapon. Accepted
 * shots are presentation events derived from authoritative armament state;
 * this component never changes damage, energy, cooldowns, or targeting.
 */
export function createPlayerBeamEffect(
  visual: BeamVisual,
  texture: Texture,
  initialWorld: WorldState,
): PlayerBeamEffect {
  const sprite = new Sprite(texture);
  sprite.anchor.set(visual.pivot.x, visual.pivot.y);
  sprite.visible = false;

  let lastObservedSequence = selectPlayerEntity(initialWorld).armament.shotSequence;
  let currentTick = initialWorld.tick;
  let active: ActiveBeam | null = null;

  const reset = (world: WorldState): void => {
    lastObservedSequence = selectPlayerEntity(world).armament.shotSequence;
    currentTick = world.tick;
    active = null;
    sprite.visible = false;
  };

  return {
    sprite,
    reset,
    advance: (world, history) => {
      currentTick = world.tick;
      const player = selectPlayerEntity(world);
      const shot = player.armament.lastAcceptedShot;
      if (!shot || shot.sequence <= lastObservedSequence) return;
      lastObservedSequence = shot.sequence;
      if (shot.weaponDefinitionId !== visual.weaponDefinitionId) return;

      // Capture the pre-advance target so a lethal shot remains visible even
      // though S12 removes the destroyed entity from the committed world.
      const fallbackOrigin = history.sample(world.playerEntityId, 1);
      const fallbackTarget = history.sample(shot.targetEntityId, 1);
      if (!fallbackOrigin || !fallbackTarget) return;
      const scatterLimit = Math.ceil(visual.impactScatterWorldUnits);
      active = Object.freeze({
        targetEntityId: shot.targetEntityId,
        expiresAfterTick: shot.tick + visual.durationFrames - 1,
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
        sprite.visible = false;
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
        sprite.visible = false;
        return;
      }
      sprite.visible = true;
      sprite.position.set(start.x, start.y);
      // Flash sets the parent clip's X scale to distance percent. The module's
      // recovered logical width includes the nested bitmap transform.
      sprite.width = distance * visual.logicalSize.width / 100;
      sprite.height = visual.logicalSize.height / zoom;
      sprite.rotation = Math.atan2(deltaY, deltaX);
    },
  };
}
