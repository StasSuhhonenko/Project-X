/** One selected-merchant cargo purchase, independent of rendering and UI. */
import type { ShipDefinition } from '../../content/schemas/game-content';
import { commitTradePurchase, selectSelectedWorldTarget, type WorldState } from '../model/world-state';
import { quoteTradePurchase, type PurchaseQuote } from '../model/purchase-quote';
export type { PurchaseQuote } from '../model/purchase-quote';

/** Quote only fully affordable, fully storable quantities; no partial transfer. */
export function quotePurchase(world: WorldState, vessel: ShipDefinition, quantityTons: number): PurchaseQuote | null {
  return quoteTradePurchase(world, vessel.cargoCapacity, quantityTons);
}

/** Recheck against current world state, then publish debit, cargo and stock together. */
export function purchaseCargo(world: WorldState, vessel: ShipDefinition, quantityTons: number): WorldState {
  const quote = quotePurchase(world, vessel, quantityTons);
  if (!quote) return world;
  const target = selectSelectedWorldTarget(world);
  if (!target || target.kind !== 'npc-ship' || !target.tradeOffer) return world;
  return commitTradePurchase(world, target.id, quote.quantityTons, vessel.cargoCapacity);
}
