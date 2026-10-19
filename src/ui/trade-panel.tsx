/** Selected-merchant offer and cargo controls; all acceptance lives in simulation. */
import type { GameModule } from '../content/game-module';
import { useAppStore } from '../app/app-store-context';
import { quotePurchase } from '../simulation/features/trade';
import { selectPlayerEntity, selectSelectedWorldTarget } from '../simulation/model/world-state';

export function TradePanel({ gameModule }: { readonly gameModule: GameModule }) {
  const world = useAppStore(state => state.world);
  const purchase = useAppStore(state => state.purchaseCargo);
  if (!world || world.status !== 'active') return null;
  const merchant = selectSelectedWorldTarget(world);
  if (!merchant || merchant.kind !== 'npc-ship' || !merchant.tradeOffer) return null;
  const player = selectPlayerEntity(world);
  const vessel = gameModule.catalog.getShipDefinition(player.definitionId);
  if (!vessel) return null;
  const offer = merchant.tradeOffer;
  const cargoTons = Object.values(player.inventory.cargo).reduce((sum, tons) => sum + tons, 0);
  const currency = gameModule.definition.resources.find(resource => resource.id === offer.currencyId);
  return <aside className="trade-panel" aria-label="Merchant trade">
    <h2>Trade</h2>
    <p>{offer.label}: {offer.stockTons} tons available at {offer.pricePerTon} {currency?.label ?? offer.currencyId} per ton.</p>
    <p>Cargo: {cargoTons}/{vessel.cargoCapacity} tons · Balance: {player.inventory.resources[offer.currencyId] ?? 0}</p>
    <button type="button" disabled={!quotePurchase(world, vessel, 1)} onClick={() => purchase(1)}>Buy 1 ton</button>
  </aside>;
}
