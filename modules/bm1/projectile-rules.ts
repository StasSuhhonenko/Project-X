/** Source-qualified Symbol116 lead/echo geometry. The engine owns identity,
 * age, collision latching and delayed impact, so these rules return motion only. */
import { z } from 'zod';
import {
  ProjectileFlightDefinitionSchema,
  type ProjectileMotion,
  type ProjectileMotionContext,
} from '@engine/simulation/contracts/projectile-rules';
import raw from './weapon-flight-data.json';

const ContentSchema = z
  .object({
    sourceSha256: z.literal('6a9bb2cd1a4ed50c7e3a59dc3395c9f254e789247eb584752fbdfcbd17b163b0'),
    profiles: z
      .array(
        ProjectileFlightDefinitionSchema.unwrap()
          .extend({
            weaponDefinitionId: z.number().int().min(6).max(19),
          })
          .strict()
          .readonly()
      )
      .length(14)
      .readonly(),
  })
  .strict()
  .superRefine((content, context) => {
    if (new Set(content.profiles.map(profile => profile.weaponDefinitionId)).size !== 14)
      context.addIssue({ code: 'custom', message: 'Every ordinary source projectile needs one profile.' });
  })
  .readonly();
const content = ContentSchema.parse(raw);
const profiles = new Map(
  content.profiles.map(
    ({ weaponDefinitionId, ...definition }) =>
      [weaponDefinitionId, ProjectileFlightDefinitionSchema.parse(definition)] as const
  )
);
export const getProjectileFlight = (weaponDefinitionId: number) => profiles.get(weaponDefinitionId) ?? null;

export function advanceProjectileMotion({
  projectile,
  definition,
  targetPosition,
}: ProjectileMotionContext): ProjectileMotion {
  if ((projectile.ageTicks - 1) % definition.moveEveryTicks !== 0)
    return Object.freeze({ position: projectile.position, rotationDegrees: projectile.rotationDegrees });
  let rotationDegrees = projectile.rotationDegrees;
  if (definition.turnDegreesPerMove > 0 && targetPosition) {
    const wanted = Math.round(
      (Math.atan2(targetPosition.y - projectile.position.y, targetPosition.x - projectile.position.x) * 180) / Math.PI
    );
    // Flash exposes _rotation in its signed canonical range. Keep the stored
    // angle continuous for interpolation, but compare that signed source view.
    const positive = ((rotationDegrees % 360) + 360) % 360;
    const sourceRotation = positive > 180 ? positive - 360 : positive;
    let difference = Math.abs(wanted - sourceRotation) + 90;
    if (difference > 360) difference -= 360;
    if (difference > 180) rotationDegrees -= definition.turnDegreesPerMove;
    if (difference < 180) rotationDegrees += definition.turnDegreesPerMove;
  }
  const radians = (rotationDegrees * Math.PI) / 180;
  const speed = definition.speedPerFrame + projectile.launchSpeedPerFrame;
  return Object.freeze({
    position: Object.freeze({
      x: projectile.position.x + Math.sin(radians) * speed,
      y: projectile.position.y - Math.cos(radians) * speed,
    }),
    rotationDegrees,
  });
}
