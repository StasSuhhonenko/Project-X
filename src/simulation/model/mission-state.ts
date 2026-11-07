/** Visit-owned delivery offers. Quantities are whole tons; prices are payment
 * resource units per ton. Entry context is retained solely for deterministic
 * restore validation, even after standing changes or a station is destroyed. */
import { z } from 'zod';
import { UInt32Schema } from '../../random/seeded-random';
import { CargoGoodsIdSchema, CargoQuantitySchema } from './cargo-state';
import { RuntimeEntityIdSchema, StationPlacementIdSchema, SystemIdSchema } from './entity-components';
import { SystemStandingSchema } from './lifecycle-state';
import { ProgressionStateSchema } from './progression-schema';

export const ContractOfferSchema = z
  .object({
    goodsId: CargoGoodsIdSchema,
    tons: CargoQuantitySchema,
    destinationSystemId: SystemIdSchema,
    basePayPerTon: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
    hazardPayPerTon: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
    negotiated: z.boolean(),
  })
  .strict()
  .readonly();
export type ContractOffer = z.infer<typeof ContractOfferSchema>;
export const ContractOfferRefSchema = z
  .object({
    visitEntityId: RuntimeEntityIdSchema,
    systemId: SystemIdSchema,
    /** Captured creation seed complements the allocated planet visit identity. */
    seed: UInt32Schema,
    kind: z.enum(['planet', 'station']),
    stationId: StationPlacementIdSchema.nullable(),
  })
  .strict()
  .refine(ref => (ref.kind === 'planet') === (ref.stationId === null))
  .readonly();
export type ContractOfferRef = z.infer<typeof ContractOfferRefSchema>;
export const VisitMissionsResultSchema = z
  .object({
    planetOffer: ContractOfferSchema.nullable(),
    stationOffers: z.record(StationPlacementIdSchema, ContractOfferSchema.nullable()).readonly(),
    surfaceMissionIndex: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    /** Generation's returned stream. Retained as replay evidence in visit state;
     * subsequent live draws always use WorldState.randomState. */
    randomState: UInt32Schema,
  })
  .strict()
  .readonly();
export type VisitMissionsResult = z.infer<typeof VisitMissionsResultSchema>;
export const ContractNegotiationResultSchema = z
  .object({
    success: z.boolean(),
    basePayPerTon: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
    randomState: UInt32Schema,
  })
  .strict()
  .readonly();
export const ContractNegotiationContextSchema = z
  .object({
    offer: ContractOfferSchema,
    progression: ProgressionStateSchema.nullable(),
    randomState: UInt32Schema,
  })
  .strict()
  .readonly();
export type ContractNegotiationContext = z.infer<typeof ContractNegotiationContextSchema>;
export type ContractNegotiationResult = z.infer<typeof ContractNegotiationResultSchema>;
export const VisitMissionStateSchema = VisitMissionsResultSchema.unwrap()
  .extend({
    visitEntityId: RuntimeEntityIdSchema,
    seed: UInt32Schema,
    systemId: SystemIdSchema,
    entryStanding: z.array(SystemStandingSchema).readonly(),
    stationIds: z.array(StationPlacementIdSchema).readonly(),
    /** Replay inputs for policies sharing the actor's commerce offer draws. */
    stationMarketSeeds: z.record(StationPlacementIdSchema, UInt32Schema).readonly().default({}),
    /** Successful negotiations carry replayable policy inputs. This bounds the
     * only mutable price; absent/accepted/failed offers need no price evidence. */
    negotiations: z.record(StationPlacementIdSchema, ContractNegotiationContextSchema).readonly(),
  })
  .strict()
  .readonly();
export type VisitMissionState = z.infer<typeof VisitMissionStateSchema>;
