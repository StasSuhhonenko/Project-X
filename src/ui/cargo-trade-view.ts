/** Copied commerce projections. UI receives quotes/intents, never writable pods,
 * merchant actors or rules. The host memoizes by the focused input signature. */
import { z } from 'zod';
import type { AppStoreState } from '../app/app-store';
import type { GameModule } from '../content/game-module';
import { ResourceSaleQuoteSchema } from '../simulation/contracts/cargo-trade';
import { quoteResourceSale } from '../simulation/features/resource-sale';
import { totalCargoTons } from '../simulation/model/cargo-quantities';
import {
  assessCargoTrade,
  CargoTradeIntentSchema,
  CargoTradeRefusalSchema,
} from '../simulation/model/cargo-transactions';
import { selectPlayerEntity, selectSelectedWorldTarget } from '../simulation/model/world-state';

const ActionSchema = z
  .object({
    intent: CargoTradeIntentSchema,
    refusal: CargoTradeRefusalSchema.nullable(),
    quantityTons: z.number().int().nonnegative(),
    amount: z.number().int().nonnegative(),
  })
  .strict()
  .readonly();
export const CommodityMarketViewSchema = z
  .object({
    merchantEntityId: z.string(),
    merchantDefinitionId: z.number().int(),
    stationId: z.string().nullable(),
    kind: z.enum(['npc-ship', 'station']),
    systemId: z.number().int(),
    rows: z
      .array(
        z
          .object({
            key: z.string(),
            goodsId: z.string(),
            label: z.string(),
            pricePerTon: z.number(),
            currencyId: z.string(),
            stockTons: z.number().nullable(),
            advertisedTons: z.number().int().nonnegative().nullable(),
            buy: ActionSchema.nullable(),
            buyStock: ActionSchema.nullable(),
            sell: ActionSchema.nullable(),
          })
          .strict()
          .readonly()
      )
      .readonly(),
  })
  .strict()
  .readonly();
export type CommodityMarketView = z.infer<typeof CommodityMarketViewSchema>;
export const CargoHoldViewSchema = z
  .object({
    capacityTons: z.number(),
    usedTons: z.number(),
    positions: z
      .array(
        z
          .object({
            slot: z.number().int(),
            goodsId: z.string().nullable(),
            label: z.string(),
            tons: z.number().int().nonnegative(),
          })
          .strict()
          .readonly()
      )
      .readonly(),
  })
  .strict()
  .readonly();
export type CargoHoldView = z.infer<typeof CargoHoldViewSchema>;
export const ResourceSalesViewSchema = z
  .array(
    z
      .object({
        resourceId: z.string(),
        label: z.string(),
        balance: z.number(),
        one: ResourceSaleQuoteSchema.nullable(),
        all: ResourceSaleQuoteSchema.nullable(),
      })
      .strict()
      .readonly()
  )
  .readonly();
export type ResourceSalesView = z.infer<typeof ResourceSalesViewSchema>;
export function selectResourceSalesView(state: AppStoreState, game: GameModule): ResourceSalesView | null {
  if (!state.world || !game.rules.quoteResourceSale) return null;
  const world = state.world,
    player = selectPlayerEntity(world);
  return ResourceSalesViewSchema.parse(
    game.definition.resources.map(resource => ({
      resourceId: resource.id,
      label: resource.label,
      balance: player.inventory.resources[resource.id] ?? 0,
      one: quoteResourceSale(world, game, { resourceId: resource.id, all: false }),
      all: quoteResourceSale(world, game, { resourceId: resource.id, all: true }),
    }))
  );
}

export function selectCommerceInputs(state: AppStoreState) {
  const world = state.world;
  if (!world || world.status !== 'active') return null;
  const merchant = selectSelectedWorldTarget(world),
    player = selectPlayerEntity(world);
  if (!merchant) return null;
  return {
    merchantEntityId: merchant.id,
    kind: merchant.kind,
    definitionId: merchant.definitionId,
    systemId: merchant.location.systemId,
    supply: merchant.kind === 'npc-ship' ? merchant.tradeOffer : null,
    demand: merchant.kind === 'npc-ship' ? merchant.tradeDemand : null,
    market: merchant.kind === 'station' ? merchant.commodityMarket : null,
    cargo: player.inventory.cargo,
    resources: player.inventory.resources,
    vesselId: player.definitionId,
    repairing: player.condition.repairing,
  };
}

export function selectCargoHoldView(state: AppStoreState, game: GameModule): CargoHoldView | null {
  if (!state.world || !game.definition.commerce) return null;
  const player = selectPlayerEntity(state.world),
    config = game.definition.commerce;
  const vessel = game.catalog.getShipDefinition(player.definitionId);
  if (!vessel) return null;
  return CargoHoldViewSchema.parse({
    capacityTons: vessel.cargoCapacity,
    usedTons: totalCargoTons(player.inventory.cargo),
    positions: Array.from({ length: config.slotCapacity }, (_, slot) => {
      const pod = player.inventory.cargo.find(pod => pod.slot === slot);
      return {
        slot,
        goodsId: pod?.goodsId ?? null,
        tons: pod?.tons ?? 0,
        label: config.goods.find(goods => goods.id === pod?.goodsId)?.label ?? '',
      };
    }),
  });
}

export function selectCommodityMarketView(state: AppStoreState, game: GameModule): CommodityMarketView | null {
  const world = state.world,
    config = game.definition.commerce;
  if (!world || world.status !== 'active' || !config) return null;
  const merchant = selectSelectedWorldTarget(world),
    player = selectPlayerEntity(world);
  if (!merchant) return null;
  const vessel = game.catalog.getShipDefinition(player.definitionId);
  if (!vessel) return null;
  const action = (side: 'buy' | 'sell', row: number, quantityTons: number) => {
    const intent = CargoTradeIntentSchema.parse({
      merchantEntityId: merchant.id,
      systemId: merchant.location.systemId,
      side,
      row,
      quantityTons,
    });
    const assessment = assessCargoTrade(
      world,
      {
        cargoCapacityTons: vessel.cargoCapacity,
        slotCapacity: config.slotCapacity,
        plan: game.rules.planCargoTransfer,
      },
      intent
    );
    return {
      intent,
      refusal: assessment.refusal,
      quantityTons: assessment.quote?.quantityTons ?? 0,
      amount: assessment.quote?.amount ?? 0,
    };
  };
  const rows =
    merchant.kind === 'station'
      ? (merchant.commodityMarket?.rows.map((terms, row) => ({
          ...terms,
          key: `row-${row}`,
          stockTons: null,
          advertisedTons: null,
          buy: action('buy', row, 1),
          buyStock: null,
          sell: action('sell', row, 1),
        })) ?? [])
      : [
          ...(merchant.tradeOffer
            ? [
                {
                  ...merchant.tradeOffer,
                  key: 'ship-supply',
                  advertisedTons: merchant.tradeOffer.stockTons,
                  buy: action('buy', 0, 1),
                  buyStock: merchant.tradeOffer.stockTons > 0 ? action('buy', 0, merchant.tradeOffer.stockTons) : null,
                  sell: null,
                },
              ]
            : []),
          ...(merchant.tradeDemand
            ? [
                {
                  ...merchant.tradeDemand,
                  key: 'ship-demand',
                  stockTons: null,
                  buy: null,
                  buyStock: null,
                  sell: action('sell', 0, 1),
                },
              ]
            : []),
        ];
  if (rows.length === 0) return null;
  return CommodityMarketViewSchema.parse({
    merchantEntityId: merchant.id,
    merchantDefinitionId: merchant.definitionId,
    stationId: merchant.kind === 'station' ? merchant.stationId : null,
    kind: merchant.kind,
    systemId: merchant.location.systemId,
    rows,
  });
}
