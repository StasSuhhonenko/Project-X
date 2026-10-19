/** Pixi adapter for module-authored, tick-driven background particles. */
import { Container, Graphics } from 'pixi.js';
import type { StarFieldDefinition } from '../content/schemas/star-field';
import type { WorldState } from '../simulation/model/world-state';
import { createStarFieldHistory } from './star-field-history';

/** Caller owns the container and destroys its children with the parent scene. */
export function createStarField(
  definition: StarFieldDefinition, bounds: Readonly<{ width: number; height: number }>, world: WorldState,
) {
  const container = new Container();
  const history = createStarFieldHistory(definition, bounds, world);
  const particles = definition.stars.map(star => {
    const particle = new Graphics().circle(0, 0, star.radius).fill({ color: definition.color, alpha: definition.alpha });
    container.addChild(particle);
    return particle;
  });
  return {
    container,
    advance: history.advance,
    reset: history.reset,
    render(alpha: number): void {
      history.sample(alpha).forEach((star, index) => {
        const particle = particles[index]!;
        particle.position.set(star.x, star.y);
        particle.scale.set(definition.stars[index]!.initialScale, star.scaleY);
        particle.rotation = star.rotationDegrees * Math.PI / 180;
      });
    },
  };
}
