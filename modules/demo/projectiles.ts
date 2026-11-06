/** Independently authored marker bolt: every-tick straight flight and a
 * two-tick impact delay. It shares no source-derived cadence or steering. */
import type {
  ProjectileFlightDefinition,
  ProjectileMotionContext,
} from '@engine/simulation/contracts/projectile-rules';

const bolt: ProjectileFlightDefinition = Object.freeze({
  speedPerFrame: 6,
  turnDegreesPerMove: 0,
  moveEveryTicks: 1,
  maximumAgeTicks: 60,
  launch: 'target',
  collisionAfterMove: true,
  impactDelayTicks: 2,
  impactDurationTicks: 6,
});
export const getProjectileFlight = (weaponDefinitionId: number) => (weaponDefinitionId === 102 ? bolt : null);
export function advanceProjectileMotion({ projectile, definition }: ProjectileMotionContext) {
  const angle = (projectile.rotationDegrees * Math.PI) / 180;
  return Object.freeze({
    position: Object.freeze({
      x: projectile.position.x + Math.sin(angle) * definition.speedPerFrame,
      y: projectile.position.y - Math.cos(angle) * definition.speedPerFrame,
    }),
    rotationDegrees: projectile.rotationDegrees,
  });
}
