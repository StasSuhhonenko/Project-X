/** One selected-merchant cargo purchase, independent of rendering and UI. */
import type { ShipDefinition } from '../../content/schemas/game-content';
import { commitTradePurchase, selectPlayerEntity, selectSelectedWorldTarget, type WorldState } from '../model/world-state';

export interface PurchaseQuote {
  readonly goodsId: string;
  readonly label: string;
  readonly quantityTons: number;
  readonly totalPrice: number;
  readonly currencyId: string;
}

/** Quote only fully affordable, fully storable quantities; no partial transfer. */
export function quotePurchase(world: WorldState, vessel: ShipDefinition, quantityTons: number): PurchaseQuote | null {
  if (world.status !== 'active' || !Number.isSafeInteger(quantityTons) || quantityTons <= 0) return null;
  const target = selectSelectedWorldTarget(world);
  if (!target || target.kind !== 'npc-ship' || !target.tradeOffer) return null;
  const offer = target.tradeOffer;
  if (quantityTons > offer.stockTons) return null;
  const player = selectPlayerEntity(world);
  const occupied = Object.values(player.inventory.cargo).reduce((sum, tons) => sum + tons, 0);
  if (occupied + quantityTons > vessel.cargoCapacity) return null;
  const totalPrice = quantityTons * offer.pricePerTon;
  if (!Number.isSafeInteger(totalPrice) || (player.inventory.resources[offer.currencyId] ?? -1) < totalPrice) return null;
  return Object.freeze({ goodsId: offer.goodsId, label: offer.label, quantityTons, totalPrice, currencyId: offer.currencyId });
}

/** Recheck against current world state, then publish debit, cargo and stock together. */
export function purchaseCargo(world: WorldState, vessel: ShipDefinition, quantityTons: number): WorldState {
  const quote = quotePurchase(world, vessel, quantityTons);
  if (!quote) return world;
  const target = selectSelectedWorldTarget(world);
  if (!target || target.kind !== 'npc-ship' || !target.tradeOffer) return world;
  return commitTradePurchase(world, target.id, quote.quantityTons, vessel.cargoCapacity);
}
