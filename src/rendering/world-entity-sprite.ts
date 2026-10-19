/** Shared Pixi presentation for non-player world entities with module visuals. */
import { Sprite, type Texture } from 'pixi.js';
import type { GameModuleDefinition } from '../content/schemas/game-module';
import type { PresentationTransform } from './transform-history';
import { worldToScreen } from './world-camera';

type EntityVisual = GameModuleDefinition['visuals']['entities'][number];
type Viewport = GameModuleDefinition['viewport'];

/**
 * View-owned binding between one runtime entity, its validated visual mapping,
 * and its Pixi sprite. It contains no simulation state.
 */
export interface WorldEntitySprite {
  readonly entityId: string;
  readonly visual: EntityVisual;
  readonly sprite: Sprite;
}

/** Create one anchored sprite without deciding its scene-layer position. */
export function createWorldEntitySprite(
  entityId: string,
  visual: EntityVisual,
  texture: Texture,
): WorldEntitySprite {
  const sprite = new Sprite(texture);
  sprite.anchor.set(visual.pivot.x, visual.pivot.y);
  return { entityId, visual, sprite };
}

/**
 * Apply one interpolated world transform in logical screen pixels. Zoom is a
 * denominator; rotation enters in degrees and Pixi receives radians.
 */
export function renderWorldEntitySprite(
  binding: WorldEntitySprite,
  transform: PresentationTransform | null,
  trackedTransform: PresentationTransform,
  viewport: Viewport,
  zoom: number,
): void {
  binding.sprite.visible = transform !== null;
  if (!transform) return;

  const position = worldToScreen(transform, trackedTransform, viewport, zoom);
  binding.sprite.position.set(position.x, position.y);
  binding.sprite.width = binding.visual.nativeSize.width / zoom;
  binding.sprite.height = binding.visual.nativeSize.height / zoom;
  binding.sprite.rotation = transform.rotationDegrees * Math.PI / 180;
}
