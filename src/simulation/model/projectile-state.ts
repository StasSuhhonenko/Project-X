/** Authoritative in-flight player shots. IDs share the world allocator but
 * projectiles are never selectable actors. Emitter/target IDs may be historical. */
import { z } from 'zod';
import { PositionSchema, PositiveDefinitionIdSchema, RuntimeEntityIdSchema, SystemIdSchema } from './entity-components';

export const ProjectileStateSchema = z.object({
  id: RuntimeEntityIdSchema,
  emitterEntityId: RuntimeEntityIdSchema,
  emitterDefinitionId: PositiveDefinitionIdSchema,
  weaponDefinitionId: PositiveDefinitionIdSchema,
  targetEntityId: RuntimeEntityIdSchema.nullable(),
  systemId: SystemIdSchema,
  position: PositionSchema,
  rotationDegrees: z.number().finite(),
  /** Captured world units per source tick; independent of later emitter motion. */
  launchSpeedPerFrame: z.number().finite().nonnegative(),
  spawnedTick: z.number().int().nonnegative().safe(),
  ageTicks: z.number().int().nonnegative().safe(),
  /** Null in flight; zero latches collision, later ages consume impact once. */
  impactAgeTicks: z.number().int().nonnegative().max(240).nullable(),
}).strict().readonly();
export type ProjectileState = z.infer<typeof ProjectileStateSchema>;
