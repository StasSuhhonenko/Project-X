/** The single purchase eligibility/calculation authority for quotes and commits. */
import { z } from 'zod';
import type { WorldState } from './world-schema';
import { selectSelectedWorldTarget } from './world-selectors';
import { TradeOfferSchema } from './trade-offer';
import { assessCargoTrade, type CargoTradeEnvironment } from './cargo-transactions';

export const PurchaseQuoteSchema = TradeOfferSchema.unwrap().pick({ goodsId: true, label: true, currencyId: true }).extend({
  quantityTons: z.number().int().positive(),
  totalPrice: z.number().int().positive(),
}).strict().readonly();
export type PurchaseQuote = z.infer<typeof PurchaseQuoteSchema>;

/** Recompute from the current immutable world; an earlier quote grants no credit.
 * All quantities are tons, prices are resource units per ton. No partial fills.
 */
export function quoteTradePurchase(world: WorldState, cargoCapacityTons: number,
  quantityTons: number, merchantId = world.selectedTargetEntityId,
  environment?: Omit<CargoTradeEnvironment,'cargoCapacityTons'>): PurchaseQuote | null {
  const target = selectSelectedWorldTarget(world);
  if (!target || target.id !== merchantId || target.kind !== 'npc-ship' || !target.tradeOffer) return null;
  const quote=assessCargoTrade(world,{cargoCapacityTons,slotCapacity:environment?.slotCapacity??128,plan:environment?.plan},
    {merchantEntityId:target.id,systemId:target.location.systemId,side:'buy',row:0,quantityTons}).quote;
  if(!quote)return null;
  return PurchaseQuoteSchema.parse({goodsId:quote.terms.goodsId,label:quote.terms.label,
    quantityTons:quote.quantityTons,totalPrice:quote.amount,currencyId:quote.terms.currencyId});
}
