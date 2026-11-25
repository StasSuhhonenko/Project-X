/** Optional construction policy. Resource amounts use declared module units;
 * progress uses raw fractional travel days and offsets use planet-relative
 * world units. The engine alone owns identity, mutation and publication. */
import { z } from 'zod';
import { StructureDefinitionSchema } from '../../content/schemas/game-content';
import { SystemDefinitionSchema } from '../../content/schemas/game-module';
import { UInt32Schema } from '../../random/seeded-random';
import { PositionSchema, ResourceBalancesSchema, UnsequencedNoticeSchema } from '../model/entity-components';

const PositiveId = z.number().int().positive();
const Amount = z.number().finite().nonnegative();
const Base = { structure: StructureDefinitionSchema, system: SystemDefinitionSchema };
const Price = z
  .object({ resourceId: z.string().min(1), amount: Amount })
  .strict()
  .readonly();
export const PlanPurchaseContextSchema = z
  .object({ ...Base, marketAdjustment: z.number().finite().nullable(), resources: ResourceBalancesSchema })
  .strict()
  .readonly();
export const PlanPurchaseDecisionSchema = z.object({ price: Price, accepted: z.boolean() }).strict().readonly();
export const ConstructionStartContextSchema = z
  .object({ ...Base, localGovernmentId: PositiveId.nullable(), resources: ResourceBalancesSchema })
  .strict()
  .readonly();
export const ConstructionStartDecisionSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('accepted'),
      cost: Price,
      initialProgress: z.number().finite().negative(),
      standingDelta: z.number().finite(),
      notice: UnsequencedNoticeSchema,
    })
    .strict()
    .readonly(),
  z
    .object({ kind: z.literal('refused'), notice: UnsequencedNoticeSchema })
    .strict()
    .readonly(),
]);
export const ConstructedStationPlacementContextSchema = z
  .object({ ...Base, playerPosition: PositionSchema, planetPosition: PositionSchema, randomState: UInt32Schema })
  .strict()
  .readonly();
export const ConstructedStationPlacementSchema = z
  .object({ positionOffset: PositionSchema, rotationDegrees: z.number().finite(), randomState: UInt32Schema })
  .strict()
  .readonly();
export const TravelProgressContextSchema = z.object({ durationDays: Amount }).strict().readonly();
export const CompletionNoticeContextSchema = z
  .object({ ...Base, name: z.string().min(1) })
  .strict()
  .readonly();
const Offers = z.array(PositiveId.nullable()).length(6).readonly();
export const ConstructedStationServicesSchema = z
  .object({
    shipOffers: Offers,
    equipmentOffers: Offers,
    planOffers: Offers,
    commodityMarketSlots: z.array(z.number().int().min(0).max(5)).max(6).readonly(),
  })
  .strict()
  .readonly();
export type PlanPurchaseContext = z.infer<typeof PlanPurchaseContextSchema>;
export type PlanPurchaseDecision = z.infer<typeof PlanPurchaseDecisionSchema>;
export type ConstructionStartContext = z.infer<typeof ConstructionStartContextSchema>;
export type ConstructionStartDecision = z.infer<typeof ConstructionStartDecisionSchema>;
export type ConstructedStationPlacementContext = z.infer<typeof ConstructedStationPlacementContextSchema>;
export type ConstructedStationPlacement = z.infer<typeof ConstructedStationPlacementSchema>;
export type TravelProgressContext = z.infer<typeof TravelProgressContextSchema>;
export type CompletionNoticeContext = z.infer<typeof CompletionNoticeContextSchema>;
export type ConstructedStationServices = z.infer<typeof ConstructedStationServicesSchema>;

/** Absent capability means no state, hook calls or random draws. Only placement
 * may advance the world stream. Services apply only to completed stations. */
export interface ConstructionRules {
  readonly planCapacity: number;
  evaluatePlanPurchase(context: PlanPurchaseContext): PlanPurchaseDecision;
  evaluateStart(context: ConstructionStartContext): ConstructionStartDecision;
  placeStation(context: ConstructedStationPlacementContext): ConstructedStationPlacement;
  travelProgress(context: TravelProgressContext): number;
  completionNotice(context: CompletionNoticeContext): z.infer<typeof UnsequencedNoticeSchema>;
  stationServices(structureId: number): ConstructedStationServices;
}
