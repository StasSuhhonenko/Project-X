/** Neutral authored capabilities consumed by station combat and reconstruction. */
import { z } from 'zod';
import { LifecycleRecordIdSchema, SystemStandingSchema } from '../../simulation/model/lifecycle-state';

export const StationLifecycleRecordSchema = z
  .object({
    id: LifecycleRecordIdSchema,
    homeSystemId: z.number().int().positive(),
    stationPlacementId: LifecycleRecordIdSchema,
    structureDefinitionId: z.number().int().positive(),
    initialPresence: z.boolean(),
    initialStrength: z.number().finite().positive(),
    maximumStrength: z.number().finite().positive(),
  })
  .strict()
  .superRefine((record, context) => {
    if (record.initialStrength > record.maximumStrength)
      context.addIssue({ code: 'custom', message: 'Initial station strength exceeds maximum.' });
  })
  .readonly();

export const LifecycleDefinitionSchema = z
  .object({
    policyId: LifecycleRecordIdSchema,
    stationRecords: z.array(StationLifecycleRecordSchema).min(1).readonly(),
    mutableStationRecordIds: z.array(LifecycleRecordIdSchema).readonly(),
    /** Consumed standing scopes; these do not grant spatial destinations. */
    standingSystemIds: z.array(SystemStandingSchema.unwrap().shape.systemId).readonly(),
    strengthSystemIds: z.array(z.number().int().positive()).readonly(),
    spawnShipDefinitionIds: z.array(z.number().int().positive()).readonly(),
    maximumSpawnsPerDeath: z.number().int().min(0).max(11).optional().default(1),
  })
  .strict()
  .readonly();
export type LifecycleDefinition = z.infer<typeof LifecycleDefinitionSchema>;
export { SystemStandingSchema };
