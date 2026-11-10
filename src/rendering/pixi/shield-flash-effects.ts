/**
 * Pixi presentation of the optional shield-impact flash.
 *
 * A flash is a colour-transformed copy of the hit actor's artwork drawn
 * directly above that actor, at the actor's own transform, opacity-scaled by
 * the actor's current alpha (a cloaked actor's flash is cloaked too, as a child
 * clip would be). Timing and triggers belong to `shared/shield-flash.ts`;
 * this adapter owns only Pixi objects: one shared colour filter and one
 * lazily created overlay sprite per actor that has flashed in this scene.
 *
 * Overlays exist only while needed: an actor that never flashes costs nothing,
 * and a hidden overlay is skipped by the renderer, so the filter runs only
 * during the few ticks a flash is visible.
 */
import { ColorMatrixFilter, Sprite, type ColorMatrix, type Container, type Texture } from 'pixi.js';
import type { WorldState } from '../../simulation/model/world-state';
import { createShieldFlashTracker, shieldFlashColorMatrix } from '../shared/shield-flash';
import type { PixiSceneDefinition } from './configuration';
import { entityVisualSize } from './entity-visual-size';

type EntityVisual = PixiSceneDefinition['visuals']['entities'][number];

/** One actor sprite the view has already positioned for this display frame. */
export interface ShieldFlashOwner {
  readonly entityId: string;
  readonly visual: EntityVisual;
  readonly sprite: Sprite;
  /** Player artwork may carry an extra player-only scale; see entity-visual-size. */
  readonly role: 'world' | 'player';
}

export interface ShieldFlashEffects {
  advance(world: WorldState): void;
  reset(world: WorldState): void;
  /** Place overlays over this frame's owners; call after every owner is rendered. */
  render(owners: readonly ShieldFlashOwner[]): void;
  /** Hide one actor's overlay (for example while a capture hides the player). */
  hide(entityId: string): void;
  destroy(): void;
}

/**
 * Return null when the module declares no flash policy. Override artwork
 * textures must already be in `textures` (see `sceneAssetPaths`).
 */
export function createShieldFlashEffects(
  initialWorld: WorldState,
  definition: PixiSceneDefinition,
  textures: ReadonlyMap<string, Texture>,
  layer: Container
): ShieldFlashEffects | null {
  const policy = definition.visuals.shieldFlash;
  if (!policy) return null;
  const filter = new ColorMatrixFilter();
  // The shared helper always returns 20 entries (row-major 5x4).
  filter.matrix = shieldFlashColorMatrix(policy) as ColorMatrix;
  const tracker = createShieldFlashTracker(initialWorld, policy, definitionId => {
    const entity = definition.content.entityDefinitions.find(candidate => candidate.id === definitionId);
    if (entity?.category !== 'ship') return undefined;
    return { hull: entity.maximumHull, shields: entity.maximumShields };
  });
  const entries = new Map(policy.entities.map(entry => [entry.entityDefinitionId, entry]));
  const overlays = new Map<string, Sprite>();

  const release = (entityId: string): void => {
    overlays.get(entityId)?.destroy({ texture: false, textureSource: false });
    overlays.delete(entityId);
  };

  /** Create the overlay just above its owner so later actors still cover both. */
  const createOverlay = (owner: ShieldFlashOwner): Sprite => {
    const artwork = entries.get(owner.visual.entityDefinitionId)?.artwork;
    const texture = artwork ? textures.get(artwork.image) : owner.sprite.texture;
    if (!texture) throw new Error('Shield flash artwork was not preloaded.');
    const overlay = new Sprite(texture);
    const pivot = artwork?.pivot ?? owner.visual.pivot;
    overlay.anchor.set(pivot.x, pivot.y);
    overlay.filters = [filter];
    layer.addChildAt(overlay, layer.getChildIndex(owner.sprite) + 1);
    overlays.set(owner.entityId, overlay);
    return overlay;
  };

  const render = (owners: readonly ShieldFlashOwner[]): void => {
    const live = new Set(owners.map(owner => owner.entityId));
    [...overlays.keys()].filter(id => !live.has(id)).forEach(release);
    owners.forEach(owner => {
      const alpha = tracker.sample(owner.entityId);
      const existing = overlays.get(owner.entityId);
      if (alpha <= 0 || !owner.sprite.visible || !entries.has(owner.visual.entityDefinitionId)) {
        if (existing) existing.visible = false;
        return;
      }
      const overlay = existing ?? createOverlay(owner);
      overlay.visible = true;
      overlay.alpha = alpha * owner.sprite.alpha;
      overlay.position.copyFrom(owner.sprite.position);
      overlay.rotation = owner.sprite.rotation;
      const artwork = entries.get(owner.visual.entityDefinitionId)?.artwork;
      if (!artwork) {
        // Same bitmap and registration as the owner: mirror its final size.
        overlay.width = owner.sprite.width;
        overlay.height = owner.sprite.height;
        return;
      }
      // Replacement art keeps its own registration but shares the owner's
      // display factor (camera zoom) and any player-only scale.
      const ownerBase = entityVisualSize(owner.visual, owner.role);
      const factor = ownerBase.width > 0 ? owner.sprite.width / ownerBase.width : 0;
      const playerScale = owner.role === 'player' ? (owner.visual.playerScale ?? 1) : 1;
      overlay.width = artwork.nativeSize.width * (artwork.scale ?? 1) * playerScale * factor;
      overlay.height = artwork.nativeSize.height * (artwork.scale ?? 1) * playerScale * factor;
    });
  };

  return Object.freeze({
    advance: tracker.advance,
    reset: (world: WorldState) => {
      tracker.reset(world);
      overlays.forEach(overlay => (overlay.visible = false));
    },
    render,
    hide: (entityId: string) => {
      const overlay = overlays.get(entityId);
      if (overlay) overlay.visible = false;
    },
    destroy: () => {
      [...overlays.keys()].forEach(release);
      filter.destroy();
    },
  });
}
