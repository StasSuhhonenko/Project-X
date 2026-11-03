/** Independent generic merchant presentation; no store or policy access. */
import type { GameModuleDefinition } from '../content/schemas/game-module';
import type { PurchaseView } from './purchase-view';

export function PurchaseReadout({ definition, purchase, onPurchaseCargo }: {
  readonly definition: GameModuleDefinition;
  readonly purchase: PurchaseView | null;
  readonly onPurchaseCargo: (quantityTons: number) => void;
}) {
  if (!purchase) return null;
  const currency = definition.resources.find(resource => resource.id === purchase.currencyId);
  const merchant = definition.content.entityDefinitions.find(entity => entity.id === purchase.merchantDefinitionId);
  return <aside className="trade-panel" aria-label="Merchant trade">
    <h2>Trade with {merchant?.name ?? purchase.merchantEntityId}</h2>
    <p>{purchase.label}: {purchase.stockTons} tons available at {purchase.pricePerTon} {currency?.label ?? purchase.currencyId} per ton.</p>
    <p>Cargo: {purchase.cargoTons}/{purchase.cargoCapacity} tons · Balance: {purchase.balance}</p>
    <button type="button" disabled={!purchase.canPurchaseOne} onClick={() => onPurchaseCargo(1)}>Buy 1 ton</button>
    <button type="button" disabled={!purchase.canPurchaseStock} onClick={() => onPurchaseCargo(purchase.stockTons)}>Buy available stock</button>
  </aside>;
}
