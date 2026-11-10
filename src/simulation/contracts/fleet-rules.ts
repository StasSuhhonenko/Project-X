/** Optional fleet policy. Prices/credits use declared resource units; positions
 * use absolute world units. Policies own names and world-stream draw order;
 * the engine owns identity, balances, actor construction and publication. */
import { z } from 'zod';
import { ShipDefinitionSchema } from '../../content/schemas/game-content';
import { SystemDefinitionSchema } from '../../content/schemas/game-module';
import { UInt32Schema } from '../../random/seeded-random';
import { PositionSchema, ResourceBalancesSchema, RotationDegreesSchema } from '../model/entity-components';
import { EncounterNameSchema } from './encounter-rules';

const Id = z.number().int().positive();
const Amount = z.number().finite().nonnegative();
const PlacementResult = { position: PositionSchema, rotationDegrees: RotationDegreesSchema, randomState: UInt32Schema };
const Base = { vessel: ShipDefinitionSchema, system: SystemDefinitionSchema };
const Placement = {
  ...Base,
  randomState: UInt32Schema,
  playerPosition: PositionSchema,
  cameraZoom: z.number().finite().positive(),
};
export const FleetAcquisitionContextSchema = z
  .object({
    ...Base,
    sourceKind: z.enum(['planet', 'station']),
    localGovernmentId: Id,
    marketAdjustment: z.number().finite().nullable(),
    resources: ResourceBalancesSchema,
    ownedShipCount: z.number().int().nonnegative(),
    empire: z
      .array(z.object({ systemId: Id, governmentId: Id, populationBillions: Amount }).strict().readonly())
      .readonly(),
  })
  .strict()
  .readonly();
export const FleetAcquisitionDecisionSchema = z
  .object({
    price: z
      .object({ resourceId: z.string().min(1), amount: Amount })
      .strict()
      .readonly(),
    refusal: z.string().min(1).nullable(),
  })
  .strict()
  .readonly();
export const FleetShipCreationContextSchema = z.object(Placement).strict().readonly();
export const FleetShipPlacementContextSchema = z
  .object({ ...Placement, name: EncounterNameSchema })
  .strict()
  .readonly();
export const FleetShipPlacementSchema = z.object(PlacementResult).strict().readonly();
export const FleetShipCreationSchema = z
  .object({
    ...PlacementResult,
    name: EncounterNameSchema,
    raceId: Id.nullable(),
  })
  .strict()
  .readonly();
export const FleetReleaseContextSchema = z
  .object({ ...Base, resources: ResourceBalancesSchema })
  .strict()
  .readonly();
export const FleetReleaseQuoteSchema = z
  .object({ resourceId: z.string().min(1), credit: Amount, releasedGovernmentId: Id })
  .strict()
  .readonly();
export type FleetAcquisitionContext = z.infer<typeof FleetAcquisitionContextSchema>;
export type FleetAcquisitionDecision = z.infer<typeof FleetAcquisitionDecisionSchema>;
export type FleetShipCreationContext = z.infer<typeof FleetShipCreationContextSchema>;
export type FleetShipCreation = z.infer<typeof FleetShipCreationSchema>;
export type FleetShipPlacementContext = z.infer<typeof FleetShipPlacementContextSchema>;
export type FleetShipPlacement = z.infer<typeof FleetShipPlacementSchema>;
export type FleetReleaseContext = z.infer<typeof FleetReleaseContextSchema>;
export type FleetReleaseQuote = z.infer<typeof FleetReleaseQuoteSchema>;
export interface FleetRules {
  readonly ownedGovernmentId: number;
  evaluateAcquisition(context: FleetAcquisitionContext): FleetAcquisitionDecision;
  createOwnedShip(context: FleetShipCreationContext): FleetShipCreation;
  placeOwnedShip(context: FleetShipPlacementContext): FleetShipPlacement;
  quoteRelease(context: FleetReleaseContext): FleetReleaseQuote | null;
}
