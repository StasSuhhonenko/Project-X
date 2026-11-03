/** Snapshot only facts consumed by departure and supported arrival reports. */
import type { GameModule } from '../content/game-module';
import { quoteSelectedTravel } from '../simulation/features/travel-quote';
import { selectPlayerEntity, type WorldState } from '../simulation/model/world-state';
import type { PlayerSpatialView } from '../ui/player-spatial-view';
import { TravelPresentationViewSchema, type TravelPresentationView } from '../ui/travel-presentation-view';
import type { AppStore } from './app-store';

export function createTravelPresentation(source: WorldState, arrival: WorldState,
  gameModule: GameModule, originSpatial: PlayerSpatialView, operationId: number,
  departureStartedAtMs: number): TravelPresentationView {
  const player = selectPlayerEntity(source);
  const arrivedPlayer = selectPlayerEntity(arrival);
  const vessel = gameModule.catalog.getShipDefinition(player.definitionId);
  if (!vessel) throw new Error('Travel presentation vessel is unavailable.');
  const quote = quoteSelectedTravel(source, { vessel, systems: gameModule.definition.systems,
    rules: gameModule.rules, resourceIds: gameModule.definition.resources.map(resource => resource.id) });
  if (quote?.status !== 'estimated') throw new Error('Travel presentation requires an estimated route.');
  return TravelPresentationViewSchema.parse({ operationId, departureStartedAtMs,
    originSystemId: player.location.systemId, destinationSystemId: arrivedPlayer.location.systemId,
    playerDefinitionId: player.definitionId, originSpatial,
    durationDays: quote.durationDays, advanceDays: quote.advanceDays, fuelResourceId: quote.fuelResourceId,
    fuelUnits: player.inventory.resources[quote.fuelResourceId]! - arrivedPlayer.inventory.resources[quote.fuelResourceId]!,
    arrivalDate: arrival.date });
}

/** Host-owned minimum display interval; cancellation releases the pending wait. */
export function createDepartureHold(durationMs: number): { readonly done: Promise<void>; cancel(): void } {
  let finish!: () => void;
  const done = new Promise<void>(resolve => { finish = resolve; });
  if (durationMs === 0) { finish(); return { done, cancel: finish }; }
  const timeout = setTimeout(finish, durationMs);
  return { done, cancel: () => { clearTimeout(timeout); finish(); } };
}

/** A retained Continue handle acknowledges only its own ready operation/session. */
export function createTravelDismissIntent(store: AppStore, displayed: TravelPresentationView | null,
  sessionRevision: number, current: () => TravelPresentationView | null,
  blocked: () => boolean, dismiss: () => void): () => void {
  return () => {
    if (!displayed || current() !== displayed || blocked()) return;
    const state = store.getState();
    if (state.sessionRevision !== sessionRevision || !state.world) return;
    if (selectPlayerEntity(state.world).location.systemId !== displayed.destinationSystemId) return;
    dismiss();
  };
}
