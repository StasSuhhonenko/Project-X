/** The single purchase eligibility/calculation authority for quotes and commits. */
import { z } from 'zod';
import { totalCargoTons } from './cargo-quantities';
import type { WorldState } from './world-schema';
import { selectPlayerEntity, selectSelectedWorldTarget } from './world-selectors';
import { TradeOfferSchema } from './trade-offer';

export const PurchaseQuoteSchema = TradeOfferSchema.unwrap().pick({ goodsId: true, label: true, currencyId: true }).extend({
  quantityTons: z.number().int().positive(),
  totalPrice: z.number().int().positive(),
}).strict().readonly();
export type PurchaseQuote = z.infer<typeof PurchaseQuoteSchema>;

/** Recompute from the current immutable world; an earlier quote grants no credit.
 * All quantities are tons, prices are resource units per ton. No partial fills.
 */
export function quoteTradePurchase(world: WorldState, cargoCapacityTons: number,
  quantityTons: number, merchantId = world.selectedTargetEntityId): PurchaseQuote | null {
  if (world.status !== 'active' || !Number.isSafeInteger(quantityTons) || quantityTons <= 0) return null;
  const target = selectSelectedWorldTarget(world);
  if (!target || target.id !== merchantId || target.kind !== 'npc-ship' || !target.tradeOffer) return null;
  const offer = target.tradeOffer;
  if (quantityTons > offer.stockTons) return null;
  const player = selectPlayerEntity(world);
  const occupied = totalCargoTons(player.inventory.cargo);
  if (!Number.isFinite(cargoCapacityTons) || occupied + quantityTons > cargoCapacityTons) return null;
  const totalPrice = quantityTons * offer.pricePerTon;
  if (!Number.isSafeInteger(totalPrice) || (player.inventory.resources[offer.currencyId] ?? -1) < totalPrice) return null;
  return Object.freeze({ goodsId: offer.goodsId, label: offer.label, quantityTons, totalPrice, currencyId: offer.currencyId });
}
