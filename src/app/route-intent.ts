/** Session/system/selection-bound presentation intents; dispatch revalidates. */
import type { AppStore } from './app-store';
import type { RouteView } from '../ui/route-view';
import { selectPlayerEntity } from '../simulation/model/world-state';

export function createRouteIntents(store: AppStore, route: RouteView | null, sessionRevision: number,
  isBusy: () => boolean, depart: () => void) {
  const isCurrent = () => {
    const state = store.getState();
    return route !== null && !isBusy() && state.screen === 'game' && state.sessionRevision === sessionRevision
      && state.world?.status === 'active'
      && selectPlayerEntity(state.world).location.systemId === route.systemId
      && state.world.selectedDestinationSystemId === route.destinationSystemId;
  };
  const validDestination = (systemId: number) => route !== null && systemId !== route.systemId
    && route.destinations.some(destination => destination.systemId === systemId);
  return Object.freeze({
    onSelectDestination: (systemId: number | null) => {
      if (!isCurrent() || !route) return;
      if (systemId !== null && (systemId === route.systemId
        || !route.destinations.some(destination => destination.systemId === systemId))) return;
      store.getState().selectDestination({ destinationSystemId: systemId });
    },
    onDepart: () => { if (isCurrent() && route?.destinationSystemId !== null) depart(); },
    onDepartTo: (systemId: number) => {
      if (!isCurrent() || !validDestination(systemId)) return;
      store.getState().selectDestination({ destinationSystemId: systemId });
      depart();
    },
  });
}
