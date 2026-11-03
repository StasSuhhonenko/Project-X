/** Bind a presentation intent to its displayed merchant and owning session. */
import type { AppStore } from './app-store';
import type { PurchaseView } from '../ui/purchase-view';
import { selectSelectedWorldTarget } from '../simulation/model/world-state';

/**
 * IDs restart after new/restored sessions, so identity alone is insufficient.
 * A retained callback cannot buy a replacement contact. The existing command
 * still revalidates current stock, capacity and payment at every dispatch.
 */
export function createPurchaseIntent(store: AppStore, purchase: PurchaseView | null,
  sessionRevision: number): (quantityTons: number) => void {
  return quantityTons => {
    if (!purchase) return;
    const state = store.getState();
    if (state.sessionRevision !== sessionRevision || state.screen !== 'game') return;
    const world = state.world;
    if (!world || world.status !== 'active') return;
    const merchant = selectSelectedWorldTarget(world);
    if (!merchant || merchant.kind !== 'npc-ship' || merchant.id !== purchase.merchantEntityId
      || merchant.location.systemId !== purchase.systemId) return;
    state.purchaseCargo(quantityTons);
  };
}
