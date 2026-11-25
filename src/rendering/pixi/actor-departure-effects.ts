/**
 * Pixi presentation of the optional actor warp-out (`visuals.departure`).
 *
 * Responsibilities:
 * - `advance` records, from each committed world, which actors are departing
 *   and their saved `elapsedTicks`. No other state is kept, so restore and
 *   rebinding need no special replay: the next frame samples the saved count.
 * - `render` runs after the view has drawn every ordinary actor sprite for the
 *   frame. For a departing actor it either stretches that sprite (`actor`
 *   samples) or hides it and draws a private flash sprite at the same
 *   registration (`flash` samples). Frame semantics and interpolation belong to
 *   `shared/actor-departure.ts`; this adapter owns only Pixi objects.
 * - Hull-damage masks and shield flashes must not be offered departing actors
 *   (the source warp frames contain only the hull and the flash), so the view
 *   filters its owner lists through `isDeparting`.
 */
import { Sprite, type Container, type Texture } from 'pixi.js';
import type { WorldState } from '../../simulation/model/world-state';
import { sampleActorDeparture } from '../shared/actor-departure';
import type { PixiSceneDefinition } from './configuration';
import type { WorldEntitySprite } from './world-entity-sprite';

export interface ActorDepartureEffects {
  /** Re-read every departure from the latest committed world. */
  advance(world: WorldState): void;
  /** True while `entityId` is warping out in the latest committed world. */
  isDeparting(entityId: string): boolean;
  /** Apply this frame's sample to already positioned actor sprites. */
  render(bindings: readonly WorldEntitySprite[], alpha: number, zoom: number): void;
  destroy(): void;
}

/**
 * Return null when the module declares no warp-out artwork; departing actors
 * then stay drawn unchanged until their removal. The flash texture must already
 * be in `textures` (see `sceneAssetPaths`).
 */
export function createActorDepartureEffects(
  initialWorld: WorldState,
  definition: PixiSceneDefinition,
  textures: ReadonlyMap<string, Texture>,
  layer: Container
): ActorDepartureEffects | null {
  const appearance = definition.visuals.departure;
  if (!appearance) return null;
  const flashArtwork = appearance.flash;
  const flashTexture = flashArtwork ? textures.get(flashArtwork.image) : undefined;
  if (flashArtwork && !flashTexture) throw new Error('Departure flash artwork was not preloaded.');
  let elapsed = new Map<string, number>();
  const flashes = new Map<string, Sprite>();

  const release = (entityId: string): void => {
    flashes.get(entityId)?.destroy({ texture: false, textureSource: false });
    flashes.delete(entityId);
  };

  const advance = (world: WorldState): void => {
    elapsed = new Map(
      world.entities.flatMap(entity =>
        entity.kind === 'npc-ship' && entity.departure ? [[entity.id, entity.departure.elapsedTicks] as const] : []
      )
    );
    [...flashes.keys()].filter(id => !elapsed.has(id)).forEach(release);
  };

  /** Create the flash just above its actor so later actors still cover both. */
  const flashFor = (binding: WorldEntitySprite): Sprite => {
    const existing = flashes.get(binding.entityId);
    if (existing) return existing;
    const flash = new Sprite(flashTexture!);
    flash.anchor.set(flashArtwork!.pivot.x, flashArtwork!.pivot.y);
    layer.addChildAt(flash, layer.getChildIndex(binding.sprite) + 1);
    flashes.set(binding.entityId, flash);
    return flash;
  };

  const render: ActorDepartureEffects['render'] = (bindings, alpha, zoom) => {
    bindings.forEach(binding => {
      const ticks = elapsed.get(binding.entityId);
      const sprite = binding.sprite;
      if (ticks === undefined || !sprite.visible) {
        release(binding.entityId);
        return;
      }
      const sample = sampleActorDeparture(appearance, ticks, alpha);
      // Local (x, y) is in the actor's unrotated frame; rotate it with the
      // sprite and divide by zoom like every other logical-pixel length.
      const cos = Math.cos(sprite.rotation),
        sin = Math.sin(sprite.rotation);
      const x = sprite.position.x + (sample.x * cos - sample.y * sin) / zoom;
      const y = sprite.position.y + (sample.x * sin + sample.y * cos) / zoom;
      if (sample.kind === 'actor') {
        release(binding.entityId);
        sprite.width *= sample.scaleX;
        sprite.height *= sample.scaleY;
        sprite.position.set(x, y);
        sprite.alpha *= sample.alpha;
        return;
      }
      const flash = flashFor(binding);
      const scale = flashArtwork!.scale ?? 1;
      flash.visible = true;
      flash.position.set(x, y);
      flash.rotation = sprite.rotation;
      flash.width = (flashArtwork!.nativeSize.width * scale * sample.scaleX) / zoom;
      flash.height = (flashArtwork!.nativeSize.height * scale * sample.scaleY) / zoom;
      flash.alpha = sprite.alpha * sample.alpha;
      sprite.visible = false;
    });
  };

  advance(initialWorld);
  return Object.freeze({
    advance,
    isDeparting: (entityId: string) => elapsed.has(entityId),
    render,
    destroy: () => [...flashes.keys()].forEach(release),
  });
}
