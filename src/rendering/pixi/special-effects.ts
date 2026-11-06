/** Disposable bitmap projections of authoritative special fields. Effects
 * own no simulation clock or random stream; collision and presentation share
 * their source transforms through the pure geometry helper. The parent scene
 * owns live sprites and shared textures; retired effects release sprites only. */
import { Matrix, Sprite, type Container, type Texture } from 'pixi.js';
import {
  specialEffectAppearance,
  specialEffectLayerMatrix,
  specialEffectLayers,
} from '../../simulation/geometry/effect-geometry';
import type { SpecialEffectState } from '../../simulation/model/special-effect-state';
import type { WorldState } from '../../simulation/model/world-state';
import { triangularOffset } from '../shared/cosmetic-scatter';
import type { PresentationTransform, TransformHistory } from '../shared/transform-history';
import { worldToScreen } from '../shared/world-camera';
import type { PixiSceneDefinition as GameModuleDefinition } from './configuration';

/** Bind to the existing effect layer, allocating nothing for an empty world.
 * Restore draws saved fields directly and never replays an emission or a hit. */
export function createSpecialEffects(
  initialWorld: WorldState,
  definition: GameModuleDefinition,
  textures: ReadonlyMap<string, Texture>,
  parent: Container
) {
  const bindings = new Map<string, Sprite[]>();
  let current = initialWorld.specialEffects;
  let previous = new Map(current.map(effect => [effect.id, effect]));
  let tick = initialWorld.tick;

  const synchronize = (world: WorldState, reset = false): void => {
    if (!reset && world.tick === tick) return;
    tick = world.tick;
    previous = new Map((reset ? world.specialEffects : current).map(effect => [effect.id, effect]));
    current = world.specialEffects;
    const live = new Set(current.map(effect => effect.id));
    bindings.forEach((sprites, id) => {
      if (live.has(id)) return;
      sprites.forEach(sprite => sprite.destroy({ texture: false, textureSource: false }));
      bindings.delete(id);
    });
  };

  return Object.freeze({
    advance: (world: WorldState) => synchronize(world),
    reset: (world: WorldState) => synchronize(world, true),
    render: (alpha: number, history: TransformHistory, player: PresentationTransform, zoom: number): void => {
      current.forEach(effect => {
        const visual = definition.visuals.specialEffects.find(candidate => candidate.id === effect.effectDefinitionId);
        if (!visual) throw new Error('Saved special effect visual is unavailable.');
        const prior = previous.get(effect.id) ?? effect;
        // Fractional visual ages never enter simulation or persistence. Only
        // pulse geometry is interpolated; tractor poses use committed age.
        const sampled: SpecialEffectState =
          effect.kind === 'pulse' && prior.kind === 'pulse'
            ? {
                ...effect,
                ageTicks: prior.ageTicks + (effect.ageTicks - prior.ageTicks) * alpha,
                scalePercent: prior.scalePercent + (effect.scalePercent - prior.scalePercent) * alpha,
                alphaPercent: prior.alphaPercent + (effect.alphaPercent - prior.alphaPercent) * alpha,
              }
            : effect;
        const geometry = definition.combatGeometry.specialEffects.find(item => item.id === effect.effectDefinitionId)!;
        const appearance = specialEffectAppearance(sampled, geometry);
        const layers = specialEffectLayers(sampled, geometry);
        const sprites = bindings.get(effect.id) ?? [];
        bindings.set(effect.id, sprites);

        layers.forEach((layer, index) => {
          const artwork = visual.layers.find(item => item.id === layer.id)!;
          const texture = textures.get(artwork.image);
          if (!texture) throw new Error('Special effect bitmap was not preloaded.');
          let sprite = sprites[index];
          if (!sprite) {
            sprite = new Sprite(texture);
            sprite.anchor.set(0, 0);
            sprites.push(sprite);
            parent.addChild(sprite);
          }
          sprite.texture = texture;
          sprite.alpha = appearance.alpha * (artwork.alphaMultiplier ?? 1);
          sprite.visible = appearance.visible && sprite.alpha > 0;
          if (!sprite.visible) return;

          if (effect.kind === 'pulse') {
            const [a, b, c, d, tx, ty] = specialEffectLayerMatrix(sampled, geometry, layer);
            const screen = worldToScreen({ x: tx, y: ty }, player, definition.viewport, zoom);
            sprite.setFromMatrix(new Matrix(a / zoom, b / zoom, c / zoom, d / zoom, screen.x, screen.y));
            return;
          }
          const emitter = history.sample(effect.emitterEntityId, alpha);
          const target = history.sample(effect.targetEntityId, alpha);
          if (!emitter || !target) {
            sprite.visible = false;
            return;
          }
          const start = worldToScreen(emitter, player, definition.viewport, zoom);
          const scatter = Math.ceil(visual.targetScatterWorldUnits ?? 0);
          const identity = Number(effect.id.slice('entity-'.length));
          const shifted = {
            ...target,
            x: target.x + triangularOffset(identity, 0x1b873593, scatter),
            y: target.y + triangularOffset(identity, 0x85ebca6b, scatter),
          };
          const end = worldToScreen(shifted, player, definition.viewport, zoom);
          const dx = end.x - start.x,
            dy = end.y - start.y;
          const distance = Math.hypot(dx, dy);
          if (distance === 0) {
            sprite.visible = false;
            return;
          }
          const [a, b, c, d, tx, ty] = specialEffectLayerMatrix({ ...effect, origin: { x: 0, y: 0 } }, geometry, layer);
          const cos = dx / distance,
            sin = dy / distance;
          const scaleX = distance / 100,
            scaleY = 1 / zoom;
          sprite.setFromMatrix(
            new Matrix(
              cos * scaleX * a - sin * scaleY * b,
              sin * scaleX * a + cos * scaleY * b,
              cos * scaleX * c - sin * scaleY * d,
              sin * scaleX * c + cos * scaleY * d,
              start.x + cos * scaleX * tx - sin * scaleY * ty,
              start.y + sin * scaleX * tx + cos * scaleY * ty
            )
          );
        });
        sprites.slice(layers.length).forEach(sprite => {
          sprite.visible = false;
        });
      });
    },
  });
}
