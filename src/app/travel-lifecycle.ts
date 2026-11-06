/** Scene-owned travel transaction: preflight -> arrival readiness -> summary.
 * Only the store commits fuel/date/world state. This owner holds the exact
 * arrival for rollback and disposes its wait/audio when the scene is replaced.
 */
import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import type { GameModule } from '../content/game-module';
import { travelToSelectedDestination } from '../simulation/features/travel';
import { selectPlayerEntity, type WorldState } from '../simulation/model/world-state';
import type { ScenePreparation } from './scene-preparation';
import { RouteErrorKindSchema, RoutePhaseSchema, type RouteErrorKind } from '../ui/route-view';
import { TravelPresentationViewSchema, type TravelPresentationOptions } from '../ui/travel-presentation-view';
import type { AppStore } from './app-store';
import { prepareTravelScene } from './travel-scene-preparation';
import { createDepartureHold, createTravelPresentation } from './travel-presentation';
import { createBrowserAudioCue } from '../platform/browser/browser-audio-cue';

const TravelLifecycleViewSchema = z.object({
  phase: RoutePhaseSchema,
  travel: TravelPresentationViewSchema.nullable(),
  error: z.string().nullable(),
  errorKind: RouteErrorKindSchema.nullable(),
  errorRevision: z.number().int().nonnegative(),
}).strict().readonly();

/** Operation handles are private service state, never serializable game data. */
type Operation =
  | { readonly kind: 'preparing'; readonly source: WorldState; readonly hold: ReturnType<typeof createDepartureHold> }
  | { readonly kind: 'arriving'; readonly arrival: WorldState };

export function createTravelLifecycle(store: AppStore, gameModule: GameModule,
  options: TravelPresentationOptions, resetInput: () => void, scenes: Pick<ScenePreparation, 'prepare' | 'projectPlayer'>) {
  const view = createStore(() => TravelLifecycleViewSchema.parse({
    phase: 'ready', travel: null, error: null, errorKind: null, errorRevision: 0,
  }));
  let operation: Operation | null = null;
  let revision = 0;
  let active = true;
  const cue = gameModule.definition.audio?.travel;
  const audio = createBrowserAudioCue(cue ? `/game/${cue}` : null);
  const publish = (patch: Partial<z.input<typeof TravelLifecycleViewSchema>>) => {
    view.setState(TravelLifecycleViewSchema.parse({ ...view.getState(), ...patch }), true);
    resetInput();
  };
  const reportError = (message: string, kind: RouteErrorKind = 'departure') => {
    publish({ error: message, errorKind: kind, errorRevision: view.getState().errorRevision + 1 });
  };
  const isBusy = () => operation !== null || view.getState().travel !== null;
  const cancelOperation = () => {
    revision += 1;
    const cancelled = operation;
    operation = null;
    if (cancelled?.kind === 'preparing') cancelled.hold.cancel();
    if (cancelled?.kind === 'arriving') store.getState().rollbackFailedTravel(cancelled.arrival);
    audio.stop();
  };

  const depart = () => {
    if (!active || isBusy()) return;
    const source = store.getState().world;
    if (!source || source.status !== 'active') return;
    const player = selectPlayerEntity(source);
    const vessel = gameModule.catalog.getShipDefinition(player.definitionId);
    const request = ++revision;
    try {
      if (!vessel) throw new Error('Active travel vessel definition is unavailable.');
      const preview = travelToSelectedDestination(source, {
        systems: gameModule.definition.systems, vessel, rules: gameModule.rules,
        lifecycle: gameModule.definition.lifecycle,
        resourceIds: gameModule.definition.resources.map(resource => resource.id),
        daysPerMajor: gameModule.definition.calendar.daysPerMajor,
      });
      if (preview === source) {
        reportError('Departure is unavailable with the current route or fuel reserve.');
        return;
      }
      const spatial = scenes.projectPlayer(source);
      const startedAt = performance.now();
      const travel = createTravelPresentation(source, preview, gameModule, spatial, request, startedAt);
      const hold = createDepartureHold(options.departureDurationMs);
      operation = { kind: 'preparing', source, hold };
      publish({ phase: 'loading', travel, error: null, errorKind: null });
      // The cue accompanies accepted departure, not the later paid arrival.
      // Play within the input turn; preload/hold never postpone it. Cancellation
      // stops it even if preparation fails before any world change is committed.
      audio.play();
      const isCurrent = () => active && revision === request && operation?.kind === 'preparing'
        && operation.source === source && store.getState().world === source;
      void Promise.all([prepareTravelScene(preview, gameModule.definition, isCurrent, scenes.prepare), hold.done])
        .then(([prepared]) => {
          if (!prepared || !isCurrent()) {
            if (active && revision === request) {
              cancelOperation();
              publish({ phase: 'ready', travel: null });
            }
            return;
          }
          const arrival = store.getState().travelToSelectedDestination();
          if (!arrival) {
            cancelOperation();
            publish({ phase: 'ready', travel: null });
            reportError('Departure is no longer available.');
            return;
          }
          // Retain rollback ownership before presentation creation/publication,
          // so a failure after the debit still restores the complete source.
          operation = { kind: 'arriving', arrival };
          publish({ phase: 'arriving', travel: createTravelPresentation(
            source, arrival, gameModule, spatial, request, startedAt) });
        })
        .catch(error => {
          if (!active || revision !== request) return;
          cancelOperation();
          publish({ phase: 'ready', travel: null });
          reportError(`Destination assets could not load: ${error instanceof Error ? error.message : String(error)}. Try again.`, 'assets');
        });
    } catch (error) {
      cancelOperation();
      publish({ phase: 'ready', travel: null });
      reportError(error instanceof Error ? error.message : String(error));
    }
  };

  return Object.freeze({
    getSnapshot: view.getState,
    subscribe: (listener: () => void) => view.subscribe(listener),
    // React may replay scene effects. A disposed request stays invalid even
    // when this same controller is activated for the next effect lifetime.
    activate: () => { active = true; },
    dispose: () => {
      if (!active) return;
      active = false;
      cancelOperation();
      publish({ phase: 'ready', travel: null });
    },
    isBusy,
    isArriving: () => operation !== null,
    shouldHidePlayer: () => Boolean(options.hidePlayerDuringDeparture && operation?.kind === 'preparing'),
    depart,
    dismiss: () => {
      if (!active || operation) return;
      publish({ travel: null });
    },
    onViewReady: (systemId: number | 'empty') => {
      if (!active || operation?.kind !== 'arriving') return;
      const { arrival } = operation;
      if (store.getState().world !== arrival || selectPlayerEntity(arrival).location.systemId !== systemId) return;
      store.getState().finishTravel(arrival);
      operation = null;
      publish({ phase: 'ready' });
    },
    onViewError: (error: Error, systemId: number | 'empty') => {
      if (!active || operation?.kind !== 'arriving') return;
      if (selectPlayerEntity(operation.arrival).location.systemId !== systemId) return;
      cancelOperation();
      publish({ phase: 'ready', travel: null });
      reportError(`Destination view failed to load: ${error.message}. Travel was cancelled; try again.`, 'view');
    },
  });
}
