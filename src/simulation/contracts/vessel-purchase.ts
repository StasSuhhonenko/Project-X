/** Neutral module policy inputs/results for a self trade-in.
 * Definitions are immutable capabilities, positions are world units, energy
 * and resource units are module-defined. No store or browser objects cross. */
import { z } from 'zod';
import { ShipDefinitionSchema } from '../../content/schemas/game-content';
import { SystemDefinitionSchema } from '../../content/schemas/game-module';
import {
  CommunicationIntentSchema,
  PlayerMotionComponentSchema,
  PositionSchema,
  ResourceBalancesSchema,
} from '../model/entity-components';

export const VesselPurchaseContextSchema = z
  .object({
    /** Absent in older policy fixtures means planet; the host always supplies it. */
    sourceKind: z.enum(['planet', 'station']).optional(),
    currentVessel: ShipDefinitionSchema,
    nextVessel: ShipDefinitionSchema,
    system: SystemDefinitionSchema,
    standing: z.number().finite().nullable(),
    playerPosition: PositionSchema,
    planetPosition: PositionSchema,
    cameraZoom: z.number().finite().positive(),
    resources: ResourceBalancesSchema,
    motion: PlayerMotionComponentSchema,
  })
  .strict()
  .readonly();
export type VesselPurchaseContext = z.infer<typeof VesselPurchaseContextSchema>;

export const VesselPurchaseApprovalSchema = z
  .object({
    /** Module launch policy may explicitly clear an active cloak. */
    resetCloak: z.boolean().optional(),
    resourceId: z.string().min(1),
    cost: z.number().finite().nonnegative(),
    /** Some source policies have a separate affordability threshold. The engine
     * requires both this threshold and actual debit coverage. */
    minimumBalance: z.number().finite().nonnegative(),
    energy: z.number().finite().nonnegative(),
    rotationDegrees: z.number().finite(),
    motion: PlayerMotionComponentSchema,
    /** Optional launch refill; all other resource balances survive the trade-in. */
    refill: z
      .object({
        resourceId: z.string().min(1),
        units: z.number().finite().nonnegative(),
      })
      .strict()
      .readonly()
      .nullable(),
    notice: CommunicationIntentSchema.nullable(),
  })
  .strict()
  .readonly();
export type VesselPurchaseApproval = z.infer<typeof VesselPurchaseApprovalSchema>;
