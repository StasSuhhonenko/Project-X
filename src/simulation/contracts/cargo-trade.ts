/** Game-neutral trade terms and bounded policy outputs. Values are whole tons
 * and currency units; policy cannot write a world, actor ID or resource key. */
import { z } from 'zod';
import type { SystemDefinition } from '../../content/schemas/game-module';
import { UInt32Schema } from '../../random/seeded-random';
import { CargoGoodsIdSchema, CargoQuantitySchema, type CargoPods } from '../model/cargo-state';
import type { Position, ResourceBalances } from '../model/entity-components';
import type { TradeOffer } from '../model/trade-offer';

export const GoodsTermsSchema = z
  .object({
    goodsId: CargoGoodsIdSchema,
    label: z.string().min(1),
    pricePerTon: CargoQuantitySchema,
    currencyId: CargoGoodsIdSchema,
  })
  .strict()
  .readonly();
export const TradeDemandSchema = GoodsTermsSchema.unwrap()
  .extend({ advertisedTons: CargoQuantitySchema })
  .strict()
  .readonly();
export const StationCommodityMarketSchema = z
  .object({ seed: UInt32Schema, rows: z.array(GoodsTermsSchema).min(1).max(32).readonly() })
  .strict()
  .readonly();
/** Largest ordered cargo-position count the shared hold model supports. */
export const MAX_CARGO_SLOT_CAPACITY = 128;
export const CommerceDefinitionSchema = z
  .object({
    slotCapacity: z.number().int().min(1).max(MAX_CARGO_SLOT_CAPACITY),
    goods: z
      .array(
        z
          .object({ id: CargoGoodsIdSchema, label: z.string().min(1) })
          .strict()
          .readonly()
      )
      .min(1)
      .max(512)
      .readonly(),
  })
  .strict()
  .readonly();
export type CommerceDefinition = z.infer<typeof CommerceDefinitionSchema>;
export type GoodsTerms = z.infer<typeof GoodsTermsSchema>;
export const CargoTransferPlanSchema = z
  .object({
    feedback: z.string().min(1).max(160).optional(),
    positions: z
      .array(
        z
          .object({ slot: z.number().int().min(0).max(127), tons: CargoQuantitySchema })
          .strict()
          .readonly()
      )
      .min(1)
      .max(128)
      .readonly(),
    amount: CargoQuantitySchema,
  })
  .strict()
  .readonly();
export type CargoTransferPlan = z.infer<typeof CargoTransferPlanSchema>;
export const CargoMarketResultSchema = z
  .object({
    supply: GoodsTermsSchema.unwrap()
      .extend({ stockTons: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) })
      .strict()
      .readonly()
      .nullable(),
    demand: TradeDemandSchema.nullable(),
    rows: z.array(GoodsTermsSchema).max(32).readonly(),
    randomState: UInt32Schema,
  })
  .strict()
  .readonly();
export type CargoMarketResult = z.infer<typeof CargoMarketResultSchema>;
export interface CargoMarketContext {
  readonly kind: 'npc-ship' | 'station';
  readonly definitionId: number;
  readonly system: SystemDefinition;
  /** Captured uint32 at actor creation; quotes/restores never advance world RNG. */
  readonly seed: number;
  readonly authoredSupply: TradeOffer | null;
}
export interface CargoTransferContext {
  readonly side: 'buy' | 'sell';
  readonly kind: 'npc-ship' | 'station';
  readonly terms: GoodsTerms;
  /** Requested units per allocation. The validated plan reports actual total
   * tonnage when a module transfers into several matching positions. */
  readonly quantityTons: number;
  readonly cargo: CargoPods;
  /** Number of module-owned cargo positions, independent of vessel tonnage. */
  readonly slotCapacity: number;
}

export const ResourceSaleIntentSchema = z
  .object({ resourceId: CargoGoodsIdSchema, all: z.boolean() })
  .strict()
  .readonly();
export type ResourceSaleIntent = z.infer<typeof ResourceSaleIntentSchema>;
export const ResourceSaleQuoteSchema = z
  .object({
    resourceId: CargoGoodsIdSchema,
    currencyId: CargoGoodsIdSchema,
    feedback: z.string().min(1).max(160).optional(),
    quantityUnits: z.number().finite().positive().max(Number.MAX_SAFE_INTEGER),
    amount: z.number().finite().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .strict()
  .readonly();
export type ResourceSaleQuote = z.infer<typeof ResourceSaleQuoteSchema>;
export interface ResourceSaleContext {
  readonly resourceId: string;
  readonly all: boolean;
  readonly resources: ResourceBalances;
  readonly system: SystemDefinition;
  readonly playerPosition: Position;
  readonly cameraZoom: number;
}
