/** Module-owned flight parameters and motion. Shared orchestration owns all
 * identity, cadence, cost and once-only impact bookkeeping. Units are world
 * units and clockwise degrees from up per fixed simulation tick. */
import { z } from 'zod';
import { PositionSchema } from '../model/entity-components';
import { ProjectileStateSchema } from '../model/projectile-state';

export const ProjectileFlightDefinitionSchema = z.object({
  speedPerFrame: z.number().finite().nonnegative(),
  turnDegreesPerMove: z.number().finite().nonnegative().max(360),
  moveEveryTicks: z.number().int().positive().max(60),
  maximumAgeTicks: z.number().int().positive().max(10000),
  launch: z.enum(['heading', 'target']),
  collisionAfterMove: z.boolean(),
  impactDelayTicks: z.number().int().positive().max(120),
  impactDurationTicks: z.number().int().positive().max(240),
}).strict().superRefine((value, context) => {
  if (value.impactDurationTicks <= value.impactDelayTicks)
    context.addIssue({ code:'custom', message:'Impact duration must include its delayed damage tick.' });
}).readonly();
export type ProjectileFlightDefinition = z.infer<typeof ProjectileFlightDefinitionSchema>;
export const ProjectileMotionContextSchema = z.object({
  projectile: ProjectileStateSchema,
  definition: ProjectileFlightDefinitionSchema,
  targetPosition: PositionSchema.nullable(),
}).strict().readonly();
export type ProjectileMotionContext = z.infer<typeof ProjectileMotionContextSchema>;
export const ProjectileMotionSchema = z.object({
  position: PositionSchema,
  rotationDegrees: z.number().finite(),
}).strict().readonly();
export type ProjectileMotion = z.infer<typeof ProjectileMotionSchema>;
