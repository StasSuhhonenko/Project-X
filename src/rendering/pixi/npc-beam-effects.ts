/** View-owned latch: observe every publication, even when several ticks precede a draw. */
import type { Container, Texture } from 'pixi.js';
import type { WorldState } from '../../simulation/model/world-state';
import type { PixiSceneDefinition } from './configuration';
import { createPlayerBeamEffect, type PlayerBeamEffect } from './player-beam-effect';

/** One reused C4 bitmap composition per emitter/weapon. Expired instances are
 * disposed, so replacements cannot grow the scene's sprite inventory forever. */
export function createNpcBeamEffects(
  initial: WorldState,
  definition: PixiSceneDefinition,
  textures: ReadonlyMap<string, Texture>,
  parent: Container
) {
  const effects = new Map<string, { effect: PlayerBeamEffect; expires: number }>();
  let baseline = initial;
  let observedTick = initial.tick;
  const remove = (key: string) => {
    effects.get(key)?.effect.sprites.forEach(sprite => {
      sprite.destroy();
    });
    effects.delete(key);
  };
  return {
    advance(world: WorldState, history: Parameters<PlayerBeamEffect['advance']>[1]) {
      effects.forEach((item, key) => {
        if (world.tick > item.expires) remove(key);
      });
      if (world.tick > observedTick)
        world.npcBeamEvents.forEach(event => {
          const visual = definition.visuals.weaponBeams.find(
            beam => beam.weaponDefinitionId === event.weaponDefinitionId
          );
          const texture = visual && textures.get(visual.image);
          if (!visual || !texture) return;
          const key = `${event.emitterEntityId}:${event.weaponDefinitionId}`;
          let item = effects.get(key);
          if (!item) {
            const effect = createPlayerBeamEffect(visual, texture, baseline, textures, 0, event.emitterEntityId);
            effect.sprites.forEach(sprite => parent.addChild(sprite));
            item = { effect, expires: 0 };
            effects.set(key, item);
          }
          item.expires = event.tick + visual.durationFrames - 1;
        });
      effects.forEach(item => item.effect.advance(world, history));
      observedTick = world.tick;
      baseline = world;
    },
    render(...args: Parameters<PlayerBeamEffect['render']>) {
      effects.forEach(item => item.effect.render(...args));
    },
    reset(world: WorldState) {
      [...effects.keys()].forEach(remove);
      baseline = world;
      observedTick = world.tick;
    },
  };
}
