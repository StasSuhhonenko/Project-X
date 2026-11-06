/** One selected-merchant cargo purchase, independent of rendering and UI. */
import type { ShipDefinition } from '../../content/schemas/game-content';
import { commitTradePurchase, selectSelectedWorldTarget, type WorldState } from '../model/world-state';
import { quoteTradePurchase, type PurchaseQuote } from '../model/purchase-quote';
import type { CargoTradeEnvironment } from '../model/cargo-transactions';
export type { PurchaseQuote } from '../model/purchase-quote';

/** Quote only fully affordable, fully storable quantities; no partial transfer. */
export function quotePurchase(world: WorldState, vessel: ShipDefinition, quantityTons: number,
  environment?:Omit<CargoTradeEnvironment,'cargoCapacityTons'>): PurchaseQuote | null {
  return quoteTradePurchase(world, vessel.cargoCapacity, quantityTons,world.selectedTargetEntityId,environment);
}

/** Recheck against current world state, then publish debit, cargo and stock together. */
export function purchaseCargo(world: WorldState, vessel: ShipDefinition, quantityTons: number,
  environment?:Omit<CargoTradeEnvironment,'cargoCapacityTons'>): WorldState {
  const quote = quotePurchase(world, vessel, quantityTons,environment);
  if (!quote) return world;
  const target = selectSelectedWorldTarget(world);
  if (!target || target.kind !== 'npc-ship' || !target.tradeOffer) return world;
  return commitTradePurchase(world, target.id, quantityTons, vessel.cargoCapacity,environment);
}
