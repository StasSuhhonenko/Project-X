/** View-owned interpolation and source impact ink for authoritative projectiles.
 * Restoring a save draws its live shots without replaying emission or damage. */
import { Container, Matrix, Sprite, type Texture } from 'pixi.js';
import type { ProjectileState } from '../../simulation/model/projectile-state';
import type { WorldState } from '../../simulation/model/world-state';
import type { PresentationTransform } from '../shared/transform-history';
import { worldToScreen } from '../shared/world-camera';
import type { PixiSceneDefinition as GameModuleDefinition } from './configuration';

export function createProjectileEffects(
  initialWorld: WorldState,
  definition: GameModuleDefinition,
  textures: ReadonlyMap<string, Texture>
) {
  const container = new Container();
  const sprites = new Map<string, Container>();
  let current = initialWorld.projectiles;
  let tick = initialWorld.tick;
  let previous = new Map(current.map(projectile => [projectile.id, projectile]));
  const synchronize = (world: WorldState, reset = false) => {
    if (!reset && world.tick === tick) return;
    tick = world.tick;
    previous = new Map((reset ? world.projectiles : current).map(projectile => [projectile.id, projectile]));
    current = world.projectiles;
    const ids = new Set(current.map(projectile => projectile.id));
    sprites.forEach((sprite, id) => {
      if (!ids.has(id)) {
        sprite.destroy({ children: true });
        sprites.delete(id);
      }
    });
  };
  return Object.freeze({
    container,
    advance: (world: WorldState) => synchronize(world),
    reset: (world: WorldState) => synchronize(world, true),
    render: (alpha: number, player: PresentationTransform, zoom: number) => {
      current.forEach((projectile: ProjectileState) => {
        const visual = definition.visuals.weaponProjectiles.find(
          visual => visual.weaponDefinitionId === projectile.weaponDefinitionId
        );
        if (!visual) throw Error('Projectile visual is unavailable.');
        const image =
          projectile.impactAgeTicks === null
            ? visual
            : visual.impactFrames.filter(frame => frame.firstImpactAgeTicks <= projectile.impactAgeTicks!).at(-1);
        let sprite = sprites.get(projectile.id);
        if (!image) {
          if (sprite) sprite.visible = false;
          return;
        }
        if (!sprite) {
          sprite = new Container();
          sprites.set(projectile.id, sprite);
          container.addChild(sprite);
        }
        sprite.visible = true;
        const layers = projectile.impactAgeTicks === null && visual.layers ? visual.layers : [image];
        // Keep one transform group per authoritative shot. Bitmap children are
        // ordered exactly like the source and never participate in collision.
        while (sprite.children.length > layers.length) sprite.removeChildAt(sprite.children.length - 1).destroy();
        layers.forEach((layer, index) => {
          const texture = textures.get(layer.image);
          if (!texture) throw Error('Projectile image was not preloaded.');
          const child = (sprite!.children[index] ?? sprite!.addChild(new Sprite(texture))) as Sprite;
          child.texture = texture;
          if ('bitmapTransform' in layer) {
            child.anchor.set(0, 0);
            child.setFromMatrix(new Matrix(...layer.bitmapTransform));
            return;
          }
          child.position.set(0, 0);
          child.rotation = 0;
          child.skew.set(0, 0);
          child.anchor.set(layer.pivot.x, layer.pivot.y);
          child.width = layer.logicalSize.width;
          child.height = layer.logicalSize.height;
        });
        const prior = previous.get(projectile.id) ?? projectile;
        const position = {
          x: prior.position.x + (projectile.position.x - prior.position.x) * alpha,
          y: prior.position.y + (projectile.position.y - prior.position.y) * alpha,
        };
        const screen = worldToScreen(position, player, definition.viewport, zoom);
        sprite.position.set(screen.x, screen.y);
        sprite.scale.set(1 / zoom);
        sprite.rotation =
          ((prior.rotationDegrees + (projectile.rotationDegrees - prior.rotationDegrees) * alpha) * Math.PI) / 180;
      });
    },
  });
}
