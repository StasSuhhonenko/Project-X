/** Pixi adapter for module-authored, tick-driven background particles. */
import { Container, Graphics } from 'pixi.js';
import type { StarFieldDefinition } from '../../content/schemas/star-field';
import type { WorldState } from '../../simulation/model/world-state';
import { createStarFieldHistory, type StarFieldContinuity } from './star-field-history';

/** Caller owns the container and destroys its children with the parent scene.
 * `carried` continues a replaced view's field in the same scene (see
 * `StarFieldContinuity`); it is ignored when it does not apply. */
export function createStarField(
  definition: StarFieldDefinition,
  bounds: Readonly<{ width: number; height: number }>,
  world: WorldState,
  carried: StarFieldContinuity | null = null
) {
  const container = new Container();
  const history = createStarFieldHistory(definition, bounds, world, carried);
  const particles = definition.stars.map(star => {
    const particle = new Graphics();
    if (star.polygon) particle.poly(star.polygon.flatMap(point => [point.x, point.y]));
    if (!star.polygon) particle.circle(0, 0, star.radius);
    particle.fill({ color: star.color ?? definition.color, alpha: definition.alpha });
    container.addChild(particle);
    return particle;
  });
  return {
    container,
    advance: history.advance,
    reset: history.reset,
    snapshot: history.snapshot,
    render(alpha: number) {
      history.sample(alpha).forEach((star, index) => {
        const particle = particles[index]!;
        particle.position.set(star.x, star.y);
        particle.scale.set(definition.stars[index]!.initialScale, star.scaleY);
        particle.rotation = (star.rotationDegrees * Math.PI) / 180;
      });
      return history.sampleOffset(alpha);
    },
  };
}
