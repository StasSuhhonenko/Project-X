/** Bind published commerce intents to their displayed merchant and session.
 * In-place stock changes are re-quoted by the store; changed terms have another
 * actor/visit identity, and restored sessions reject every retained callback. */
import type { CargoTradeIntent, CargoTradeRefusal } from '../simulation/model/cargo-transactions';
import type { CommodityMarketView } from '../ui/cargo-trade-view';
import type { AppStore } from './app-store';

export function createCargoTradeIntent(store: AppStore, market: CommodityMarketView | null, sessionRevision: number) {
  return (intent: CargoTradeIntent): CargoTradeRefusal | null => {
    const state = store.getState();
    if (
      !market ||
      state.screen !== 'game' ||
      state.sessionRevision !== sessionRevision ||
      intent.merchantEntityId !== market.merchantEntityId ||
      intent.systemId !== market.systemId
    )
      return 'unavailable';
    return state.tradeCargo(intent);
  };
}
