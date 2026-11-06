/** Narrow immutable purchase facts; simulation evaluates payable quantities. */
import type { AppStoreState } from '../app/app-store';
import type { GameModule } from '../content/game-module';
import { quotePurchase } from '../simulation/features/trade';
import { totalCargoTons } from '../simulation/model/cargo-quantities';
import { resolveCargoTransferEnvironment } from '../simulation/model/cargo-transactions';
import { selectPlayerEntity, selectSelectedWorldTarget } from '../simulation/model/world-state';
import type { PurchaseView } from './purchase-view';

/** Flat scalars let shallow subscribers ignore movement, durability and the clock. */
export function selectPurchaseView(state: AppStoreState, gameModule: GameModule): PurchaseView | null {
  const world = state.world;
  if (!world || world.status !== 'active') return null;
  const merchant = selectSelectedWorldTarget(world);
  if (!merchant || merchant.kind !== 'npc-ship' || !merchant.tradeOffer) return null;
  const player = selectPlayerEntity(world);
  const vessel = gameModule.catalog.getShipDefinition(player.definitionId);
  if (!vessel) throw new Error('Active purchase vessel definition is unavailable.');
  const offer = merchant.tradeOffer;
  const environment = resolveCargoTransferEnvironment(gameModule);
  return Object.freeze({
    merchantEntityId: merchant.id,
    merchantDefinitionId: merchant.definitionId,
    systemId: merchant.location.systemId,
    goodsId: offer.goodsId,
    label: offer.label,
    stockTons: offer.stockTons,
    pricePerTon: offer.pricePerTon,
    currencyId: offer.currencyId,
    cargoTons: totalCargoTons(player.inventory.cargo),
    cargoCapacity: vessel.cargoCapacity,
    balance: player.inventory.resources[offer.currencyId] ?? 0,
    canPurchaseOne: quotePurchase(world, vessel, 1, environment) !== null,
    canPurchaseStock: quotePurchase(world, vessel, offer.stockTons, environment) !== null,
  });
}
