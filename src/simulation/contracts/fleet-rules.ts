/** Optional fleet policy. Prices/credits use declared resource units; positions
 * use absolute world units. Policies own names and world-stream draw order;
 * the engine owns identity, balances, actor construction and publication. */
import { z } from 'zod';
import { ShipDefinitionSchema } from '../../content/schemas/game-content';
import { SystemDefinitionSchema } from '../../content/schemas/game-module';
import { UInt32Schema } from '../../random/seeded-random';
import {
  NoticeMessageSchema,
  PositionSchema,
  ResourceBalancesSchema,
  RotationDegreesSchema,
  RuntimeEntityIdSchema,
} from '../model/entity-components';
import { NpcCombatStateSchema } from '../model/npc-state';
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
  readonly orders?: FleetOrderRules;
  readonly ownedGovernmentId: number;
  evaluateAcquisition(context: FleetAcquisitionContext): FleetAcquisitionDecision;
  createOwnedShip(context: FleetShipCreationContext): FleetShipCreation;
  placeOwnedShip(context: FleetShipPlacementContext): FleetShipPlacement;
  quoteRelease(context: FleetReleaseContext): FleetReleaseQuote | null;
}

/** Opaque module IDs. No command spelling, ordering meaning or hull-size rule
 * belongs to the engine. Declarations are validated once at module activation. */
export const FleetOrderDeclarationsSchema = z
  .object({
    declaredOrders: z
      .array(
        z
          .object({ id: z.string().min(1), followsTravel: z.boolean() })
          .strict()
          .readonly()
      )
      .readonly(),
    declaredMissions: z.array(z.string().min(1)).readonly(),
  })
  .strict()
  .superRefine((value, context) => {
    const orders = value.declaredOrders.map(row => row.id);
    if (
      new Set(orders).size !== orders.length ||
      new Set(value.declaredMissions).size !== value.declaredMissions.length
    )
      context.addIssue({ code: 'custom', message: 'Fleet order and mission IDs must be unique.' });
  })
  .readonly();
export const FleetOrderContextSchema = z
  .object({
    commandId: z.string().min(1),
    recipientEntityIds: z.array(RuntimeEntityIdSchema).readonly(),
    playerEntityId: RuntimeEntityIdSchema,
    planetEntityId: RuntimeEntityIdSchema,
    selectedTargetEntityId: RuntimeEntityIdSchema.nullable(),
  })
  .strict()
  .readonly();
export const FleetOrderResolutionSchema = z
  .object({
    writes: z
      .array(
        z
          .object({
            entityId: RuntimeEntityIdSchema,
            orderId: z.string().min(1).nullable(),
            alert: NpcCombatStateSchema.unwrap().shape.alert,
            targetEntityId: RuntimeEntityIdSchema.nullable(),
          })
          .strict()
          .readonly()
      )
      .readonly(),
    notice: NoticeMessageSchema.nullable(),
  })
  .strict()
  .readonly();
/** Absolute world positions and camera zoom let the module reuse its sole
 * world-to-source-stage conversion. Dimensions/size thresholds are module policy. */
export const FleetRecallContextSchema = z
  .object({
    playerVessel: ShipDefinitionSchema,
    craftVessel: ShipDefinitionSchema,
    playerPosition: PositionSchema,
    craftPosition: PositionSchema,
    cameraZoom: z.number().finite().positive(),
  })
  .strict()
  .readonly();
export type FleetOrderContext = z.infer<typeof FleetOrderContextSchema>;
export type FleetOrderResolution = z.infer<typeof FleetOrderResolutionSchema>;
export type FleetRecallContext = z.infer<typeof FleetRecallContextSchema>;
export interface FleetOrderRules extends z.infer<typeof FleetOrderDeclarationsSchema> {
  resolveOrder(context: FleetOrderContext): FleetOrderResolution;
  canRecall(context: FleetRecallContext): boolean;
}
