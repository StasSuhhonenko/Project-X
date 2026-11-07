/** One live assessment and atomic settlement path for ship and station trade.
 * Module policy chooses bounded allocations/pricing; this owner enforces goods,
 * position, stock, capacity, safe arithmetic and resource invariants. */
import { z } from 'zod';
import type { GameModule } from '../../content/game-module';
import {
  CargoTransferPlanSchema,
  GoodsTermsSchema,
  MAX_CARGO_SLOT_CAPACITY,
  type CargoTransferContext,
  type CargoTransferPlan,
} from '../contracts/cargo-trade';
import { planLinearCargoTransfer } from './cargo-allocation';
import { totalCargoTons } from './cargo-quantities';
import { CargoQuantitySchema, changeCargoPods } from './cargo-state';
import { RuntimeEntityIdSchema, SystemIdSchema } from './entity-components';
import { parseWorldState, type WorldState } from './world-schema';
import { selectPlayerEntity, selectSelectedWorldTarget } from './world-selectors';

export const CargoTradeIntentSchema = z
  .object({
    merchantEntityId: RuntimeEntityIdSchema,
    systemId: SystemIdSchema,
    side: z.enum(['buy', 'sell']),
    row: z.number().int().min(0).max(31),
    quantityTons: CargoQuantitySchema,
  })
  .strict()
  .readonly();
export type CargoTradeIntent = z.infer<typeof CargoTradeIntentSchema>;
export const CargoTradeRefusalSchema = z.enum([
  'unavailable',
  'quantity',
  'stock',
  'positions',
  'capacity',
  'funds',
  'overflow',
]);
export type CargoTradeRefusal = z.infer<typeof CargoTradeRefusalSchema>;
const QuoteSchema = z
  .object({
    terms: GoodsTermsSchema,
    positions: CargoTransferPlanSchema.unwrap().shape.positions,
    feedback: z.string().min(1).max(160),
    amount: CargoQuantitySchema,
    quantityTons: CargoQuantitySchema,
  })
  .strict()
  .readonly();
export type CargoTradeQuote = z.infer<typeof QuoteSchema>;
export interface CargoTradeEnvironment {
  readonly cargoCapacityTons: number;
  readonly slotCapacity: number;
  readonly plan?: ((context: CargoTransferContext) => CargoTransferPlan | null) | undefined;
}
/** Modules without an authored commerce capability get the full shared hold. */
export const DEFAULT_CARGO_SLOT_CAPACITY = MAX_CARGO_SLOT_CAPACITY;

/** Resolve module-owned transfer policy for purchase quotes and commits.
 * Vessel tonnage stays a separate live input because a refit can replace it. */
export function resolveCargoTransferEnvironment(
  gameModule: GameModule
): Omit<CargoTradeEnvironment, 'cargoCapacityTons'> {
  return {
    slotCapacity: gameModule.definition.commerce?.slotCapacity ?? DEFAULT_CARGO_SLOT_CAPACITY,
    plan: gameModule.rules.planCargoTransfer,
  };
}

export interface CargoTradeAssessment {
  readonly quote: CargoTradeQuote | null;
  readonly refusal: CargoTradeRefusal | null;
}

/** Terms are immutable for the visit; mutable finite stock is read at dispatch. */
export function assessCargoTrade(
  world: WorldState,
  environment: CargoTradeEnvironment,
  input: CargoTradeIntent
): CargoTradeAssessment {
  const refuse = (refusal: CargoTradeRefusal): CargoTradeAssessment => Object.freeze({ quote: null, refusal });
  const parsed = CargoTradeIntentSchema.safeParse(input);
  if (!parsed.success) return refuse('quantity');
  const intent = parsed.data,
    target = selectSelectedWorldTarget(world),
    player = selectPlayerEntity(world);
  if (
    world.status !== 'active' ||
    player.condition.repairing ||
    !target ||
    target.id !== intent.merchantEntityId ||
    target.location.systemId !== intent.systemId ||
    player.location.systemId !== intent.systemId
  )
    return refuse('unavailable');
  const raw =
    target.kind === 'station'
      ? target.commodityMarket?.rows[intent.row]
      : intent.row === 0
        ? intent.side === 'buy'
          ? target.tradeOffer
          : target.tradeDemand
        : null;
  if (!raw) return refuse('unavailable');
  const terms = GoodsTermsSchema.parse({
    goodsId: raw.goodsId,
    label: raw.label,
    pricePerTon: raw.pricePerTon,
    currencyId: raw.currencyId,
  });
  if (
    !Number.isSafeInteger(environment.slotCapacity) ||
    environment.slotCapacity < 1 ||
    environment.slotCapacity > MAX_CARGO_SLOT_CAPACITY ||
    !Number.isFinite(environment.cargoCapacityTons) ||
    environment.cargoCapacityTons < 0
  )
    return refuse('unavailable');
  if (target.kind === 'station' && intent.quantityTons !== 1) return refuse('quantity');
  const context = Object.freeze({
    side: intent.side,
    kind: target.kind,
    terms,
    quantityTons: intent.quantityTons,
    cargo: player.inventory.cargo,
    slotCapacity: environment.slotCapacity,
  });
  const proposal = (environment.plan ?? planLinearCargoTransfer)(context);
  if (!proposal) return refuse('positions');
  const plan = CargoTransferPlanSchema.safeParse(proposal);
  if (!plan.success) return refuse('overflow');
  const positions = plan.data.positions;
  if (
    new Set(positions.map(p => p.slot)).size !== positions.length ||
    positions.some(position => {
      if (position.slot >= environment.slotCapacity) return true;
      const pod = player.inventory.cargo.find(pod => pod.slot === position.slot);
      if (pod?.contract) return true;
      if (intent.side === 'buy') return pod !== undefined && pod.goodsId !== terms.goodsId;
      return !pod || pod.goodsId !== terms.goodsId || position.tons > pod.tons;
    })
  )
    return refuse('positions');
  const quantityTons = positions.reduce((sum, position) => sum + position.tons, 0);
  if (!Number.isSafeInteger(quantityTons)) return refuse('overflow');
  const occupied = totalCargoTons(player.inventory.cargo);
  if (intent.side === 'buy' && !Number.isSafeInteger(occupied + quantityTons)) return refuse('overflow');
  if (intent.side === 'buy' && occupied + quantityTons > environment.cargoCapacityTons) return refuse('capacity');
  if (intent.side === 'buy' && target.kind === 'npc-ship' && quantityTons > target.tradeOffer!.stockTons)
    return refuse('stock');
  const balance = player.inventory.resources[terms.currencyId];
  if (balance === undefined) return refuse('unavailable');
  if (intent.side === 'buy' && balance < plan.data.amount) return refuse('funds');
  const nextBalance = balance + (intent.side === 'sell' ? 1 : -1) * plan.data.amount;
  if (!Number.isFinite(nextBalance) || nextBalance < 0 || nextBalance > Number.MAX_SAFE_INTEGER)
    return refuse('overflow');
  return Object.freeze({
    quote: QuoteSchema.parse({
      terms,
      positions,
      amount: plan.data.amount,
      quantityTons,
      feedback: plan.data.feedback ?? 'Cargo transfer complete.',
    }),
    refusal: null,
  });
}

/** The exact old world survives every refusal; no time or RNG is consumed. */
export function settleCargoTrade(
  world: WorldState,
  environment: CargoTradeEnvironment,
  intent: CargoTradeIntent
): {
  readonly world: WorldState;
  readonly refusal: CargoTradeRefusal | null;
} {
  const assessment = assessCargoTrade(world, environment, intent),
    quote = assessment.quote;
  if (!quote) return { world, refusal: assessment.refusal };
  const player = selectPlayerEntity(world),
    sign = intent.side === 'buy' ? 1 : -1;
  const cargo = changeCargoPods(
    player.inventory.cargo,
    quote.terms.goodsId,
    quote.positions.map(p => ({ slot: p.slot, tons: p.tons * sign }))
  );
  const resources = {
    ...player.inventory.resources,
    [quote.terms.currencyId]: player.inventory.resources[quote.terms.currencyId]! - sign * quote.amount,
  };
  const sequence = (player.feedback.notice?.sequence ?? 0) + 1;
  if (!Number.isSafeInteger(sequence)) return { world, refusal: 'overflow' };
  const next = parseWorldState({
    ...world,
    entities: world.entities.map(entity => {
      if (entity.id === player.id && entity.kind === 'player-ship')
        return {
          ...entity,
          inventory: { resources, cargo },
          feedback: {
            ...player.feedback,
            notice: { sequence, code: 'cargo-trade', message: quote.feedback },
          },
        };
      if (intent.side === 'buy' && entity.id === intent.merchantEntityId && entity.kind === 'npc-ship')
        return {
          ...entity,
          tradeOffer: { ...entity.tradeOffer!, stockTons: entity.tradeOffer!.stockTons - quote.quantityTons },
        };
      return entity;
    }),
  });
  return { world: next, refusal: null };
}
