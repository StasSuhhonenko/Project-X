/**
 * View-only destruction hold (`visuals.destruction`).
 *
 * The simulation removes a destroyed actor, and settles every outcome, on its
 * death tick. A module whose original clip kept drawing the hull under its
 * explosion declares `hullTicks`; this adapter then keeps the actor's existing
 * sprite in place, unmoving at its death transform, for that many fixed ticks
 * counting the death tick, and releases it afterwards. Explosion artwork
 * itself belongs to the module's overlay.
 *
 * The death is recognised from the publication's `actorDeathEvents`, which are
 * transient: a restore, travel or remount drops any hull still being held.
 * The held hull carries no damage mask or shield flash and is never a contact.
 */
import type { WorldState } from '../../simulation/model/world-state';
import type { PresentationTransform } from '../shared/transform-history';
import type { PixiSceneDefinition } from './configuration';
import { renderWorldEntitySprite, type WorldEntitySprite } from './world-entity-sprite';

type DeathEvent = WorldState['actorDeathEvents'][number];

export interface ActorWrecks {
  /** Keep a binding whose actor died in `world`. False leaves disposal to the caller. */
  adopt(binding: WorldEntitySprite, world: WorldState): boolean;
  /** Release every hull whose hold has elapsed at `world.tick`. */
  advance(world: WorldState): void;
  render(camera: PresentationTransform, zoom: number): void;
  /** Drop every held hull (restore, rebase or teardown). */
  clear(): void;
}

export function createActorWrecks(definition: PixiSceneDefinition): ActorWrecks {
  const hold = definition.visuals.destruction;
  let wrecks: { readonly binding: WorldEntitySprite; readonly event: DeathEvent }[] = [];
  const release = (binding: WorldEntitySprite) => binding.sprite.destroy({ texture: false, textureSource: false });
  return {
    adopt(binding, world) {
      if (!hold) return false;
      const event = world.actorDeathEvents.find(candidate => candidate.actorEntityId === binding.entityId);
      if (!event || world.tick - event.tick >= hold.hullTicks) return false;
      wrecks.push({ binding, event });
      return true;
    },
    advance(world) {
      if (!hold) return;
      wrecks = wrecks.filter(wreck => {
        if (world.tick >= wreck.event.tick && world.tick - wreck.event.tick < hold.hullTicks) return true;
        release(wreck.binding);
        return false;
      });
    },
    render(camera, zoom) {
      wrecks.forEach(({ binding, event }) =>
        renderWorldEntitySprite(
          binding,
          { ...event.position, rotationDegrees: event.rotationDegrees },
          camera,
          definition.viewport,
          zoom
        )
      );
    },
    clear() {
      wrecks.forEach(wreck => release(wreck.binding));
      wrecks = [];
    },
  };
}
