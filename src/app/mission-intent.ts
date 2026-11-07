/** Bind callbacks to the displayed session AND allocated planet identity.
 * Runtime planet identity prevents a repeated seed from reviving stale intents. */
import type { ContractOfferRef } from '../simulation/model/mission-state';
import type { MissionView } from '../ui/mission-view';
import type { AppStore } from './app-store';

export function createMissionIntents(store: AppStore, view: MissionView | null, sessionRevision: number) {
  const current = () => {
    const state = store.getState(),
      visit = state.world?.missions;
    return Boolean(
      view &&
      state.screen === 'game' &&
      state.sessionRevision === sessionRevision &&
      visit?.visitEntityId === view.visitEntityId &&
      visit.systemId === view.systemId &&
      visit.seed === view.seed
    );
  };
  const hasOffer = (ref: ContractOfferRef) =>
    view?.offers.some(
      ({ ref: shown }) =>
        shown.visitEntityId === ref.visitEntityId &&
        shown.systemId === ref.systemId &&
        shown.seed === ref.seed &&
        shown.kind === ref.kind &&
        shown.stationId === ref.stationId
    );
  return Object.freeze({
    acceptContract: (ref: ContractOfferRef) =>
      current() && hasOffer(ref) === true && store.getState().acceptContract(ref),
    negotiateContract: (ref: ContractOfferRef) =>
      current() && hasOffer(ref) === true && store.getState().negotiateContract(ref),
    transportToSurface: () => current() && store.getState().transportToSurface(),
  });
}
