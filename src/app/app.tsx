/** React scene composition and lifecycle for the current playable slice. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { createBrowserSimulationLifecycle } from '../platform/browser/browser-simulation-lifecycle';
import { createKeyboardControls, type KeyboardControls } from '../platform/keyboard/keyboard-controls';
import type { GameplayPresentation } from '../ui/gameplay-presentation';
import { selectGameHudView } from '../ui/game-hud-selector';
import { selectSelectedTargetView } from '../ui/selected-target-selector';
import { selectPlanetContactView, selectSelectedContactView } from '../ui/contact-selector';
import { IDLE_PLAYER_CONTROLS } from '../simulation/commands/player-controls';
import { GameSceneErrorBoundary } from './game-scene-error-boundary';
import { GameViewport } from '../ui/game-viewport';
import type { PixiGameView } from '../rendering/pixi-game-view';
import type { EntryPresentation } from '../ui/entry-presentation';
import { PlayerDeathScreen } from '../ui/player-death-screen';
import { RepairPanel } from '../ui/repair-panel';
import { TradePanel } from '../ui/trade-panel';
import { MapPanel } from '../ui/map-panel';
import { useSavePanel } from '../ui/save-panel';
import type { GameModule } from '../content/game-module';
import type { AppStore } from './app-store';
import { useAppStore } from './app-store-context';
import { selectPlayerEntity, type WorldState } from '../simulation/model/world-state';
import { travelToSelectedDestination } from '../simulation/features/travel';
import { prepareTravelScene } from './travel-scene-preparation';

/** Connect the selected entry to validated commands and host save operations. */
export function App({ store, gameModule, entryPresentation: Entry, gameplayPresentation }: {
  readonly store: AppStore;
  readonly gameModule: GameModule;
  readonly entryPresentation: EntryPresentation;
  readonly gameplayPresentation: GameplayPresentation;
}) {
  const screen = useAppStore(state => state.screen);
  const worldStatus = useAppStore(state => state.world?.status ?? null);
  const sessionRevision = useAppStore(state => state.sessionRevision);
  const startGame = useAppStore(state => state.startGame);
  const returnToMenu = useAppStore(state => state.returnToMenu);
  const saveTools = useSavePanel({ store, gameModule,
    canSave: screen === 'game' && worldStatus === 'active' });
  return <div className="app-shell">
    {screen === 'main-menu' && <Entry definition={gameModule.definition}
      onStart={startGame} saveTools={saveTools} />}
    {screen === 'game' && worldStatus === 'player-destroyed'
      && <PlayerDeathScreen definition={gameModule.definition} />}
    {screen === 'game' && worldStatus !== 'player-destroyed'
      && <GameSceneErrorBoundary key={sessionRevision} onReturnToMenu={returnToMenu} saveTools={saveTools}>
        <GameScene store={store} gameModule={gameModule}
          gameplayPresentation={gameplayPresentation} saveTools={saveTools} />
      </GameSceneErrorBoundary>}
    {screen === 'game' && worldStatus === 'player-destroyed' && saveTools}
  </div>;
}

/**
 * Owns services whose lifetime is exactly one active game scene. Unmounting the
 * scene removes keyboard listeners, stops animation scheduling, and lets the
 * viewport dispose its Pixi resources independently.
 */
function GameScene({ store, gameModule, gameplayPresentation: Presentation, saveTools }: {
  readonly store: AppStore;
  readonly gameModule: GameModule;
  readonly gameplayPresentation: GameplayPresentation;
  readonly saveTools: ReactNode;
}) {
  const viewRef = useRef<PixiGameView | null>(null);
  const operationRef = useRef(0);
  const loadingRef = useRef(false);
  const pendingArrivalRef = useRef<WorldState | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const keyboardRef = useRef<KeyboardControls | null>(null);
  const inputAvailableRef = useRef(false);
  const onInputAvailabilityChange = useCallback((available: boolean) => {
    inputAvailableRef.current = available;
    keyboardRef.current?.reset();
  }, []);
  const hud = useAppStore(useShallow(selectGameHudView));
  const target = useAppStore(useShallow(selectSelectedTargetView));
  const planetContact = useAppStore(useShallow(selectPlanetContactView));
  const selectedContact = useAppStore(useShallow(selectSelectedContactView));
  const onClearTarget = useCallback(() => store.getState().selectTarget(null), [store]);
  const returnToMenu = useAppStore(state => state.returnToMenu);
  const [travelPhase, setTravelPhase] = useState<'ready' | 'loading' | 'arriving'>('ready');
  const departing = travelPhase !== 'ready';
  const [travelError, setTravelError] = useState<string | null>(null);
  const viewKey = useAppStore(state => state.world
    ? selectPlayerEntity(state.world).location.systemId : 'empty');
  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);
  const onViewReady = useCallback((view: PixiGameView | null) => {
    viewRef.current = view;
    // Flight requires both spatial and selected UI readiness. Keys held during
    // initial view creation or a view replacement cannot leak into that scene.
    keyboardRef.current?.reset();
    if (!view || !pendingArrivalRef.current) return;
    const arrival = pendingArrivalRef.current;
    if (store.getState().world !== arrival) return;
    if (selectPlayerEntity(arrival).location.systemId !== viewKey) return;
    store.getState().finishTravel(arrival);
    pendingArrivalRef.current = null;
    loadingRef.current = false;
    setTravelPhase('ready');
  }, [store, viewKey]);
  const onViewError = useCallback((error: Error) => {
    const arrival = pendingArrivalRef.current;
    if (!arrival) return;
    if (selectPlayerEntity(arrival).location.systemId !== viewKey) return;
    operationRef.current += 1;
    pendingArrivalRef.current = null;
    loadingRef.current = false;
    stopAudio();
    store.getState().rollbackFailedTravel(arrival);
    setTravelPhase('ready');
    setTravelError(`Destination view failed to load: ${error.message}. Travel was cancelled; try again.`);
  }, [store, stopAudio, viewKey]);
  const onDepart = useCallback(() => {
    if (departing || loadingRef.current || pendingArrivalRef.current) return;
    const source = store.getState().world;
    if (!source || source.status !== 'active') return;
    const player = selectPlayerEntity(source);
    const vessel = gameModule.catalog.getShipDefinition(player.definitionId);
    if (!vessel) throw new Error('Active travel vessel definition is unavailable.');
    let preview: WorldState;
    try {
      preview = travelToSelectedDestination(source, {
        systems: gameModule.definition.systems, vessel, rules: gameModule.rules,
        resourceIds: gameModule.definition.resources.map(resource => resource.id),
        daysPerMajor: gameModule.definition.calendar.daysPerMajor,
      });
    } catch (error) {
      setTravelError(error instanceof Error ? error.message : String(error));
      return;
    }
    if (preview === source) {
      setTravelError('Departure is unavailable with the current route or fuel reserve.');
      return;
    }
    setTravelError(null);
    setTravelPhase('loading');
    loadingRef.current = true;
    const operation = ++operationRef.current;
    void prepareTravelScene(preview, gameModule.definition,
      () => operationRef.current === operation && store.getState().world === source).then(current => {
      // A newer request, unmount, or world change invalidates the prepared scene.
      if (!current) {
        if (operationRef.current === operation) {
          loadingRef.current = false;
          setTravelPhase('ready');
        }
        return;
      }
      const arrival = store.getState().travelToSelectedDestination();
      if (!arrival) {
        loadingRef.current = false;
        setTravelPhase('ready');
        setTravelError('Departure is no longer available.');
        return;
      }
      pendingArrivalRef.current = arrival;
      setTravelPhase('arriving');
      stopAudio();
      const cue = gameModule.definition.audio?.travel;
      if (cue) {
        try {
          const audio = new Audio(`/game/${cue}`);
          audioRef.current = audio;
          // The sound is a departure cue; browser playback never gates travel.
          void audio.play().catch(() => { if (audioRef.current === audio) audioRef.current = null; });
        } catch {
          // Audio device/API failure cannot reverse an already valid departure.
          audioRef.current = null;
        }
      }
    }).catch(error => {
      if (operationRef.current !== operation) return;
      loadingRef.current = false;
      setTravelPhase('ready');
      setTravelError(`Destination assets could not load: ${error instanceof Error ? error.message : String(error)}. Try again.`);
    });
  }, [departing, store, gameModule, stopAudio]);
  useEffect(() => {
    const keyboard = createKeyboardControls();
    keyboardRef.current = keyboard;
    const simulation = createBrowserSimulationLifecycle({
      framesPerSecond: gameModule.definition.framesPerSecond,
      update: () => {
        if (operationRef.current > 0 && (pendingArrivalRef.current || loadingRef.current)) return;
        store.getState().advanceWorld(inputAvailableRef.current && viewRef.current
          ? keyboard.sample() : IDLE_PLAYER_CONTROLS);
      },
      render: alpha => viewRef.current?.render(alpha),
      resetPresentation: () => {
        keyboard.reset();
        viewRef.current?.reset();
      },
    });
    simulation.start();

    return () => {
      operationRef.current += 1;
      simulation.stop();
      keyboard.dispose();
      keyboardRef.current = null;
      stopAudio();
    };
  }, [store, gameModule, stopAudio]);

  if (!hud) return null;
  const viewport = <GameViewport key={viewKey} store={store} definition={gameModule.definition}
    onViewReady={onViewReady} onViewError={onViewError} />;
  const sliceTools = <>
      <RepairPanel gameModule={gameModule} />
      <TradePanel gameModule={gameModule} />
      <MapPanel gameModule={gameModule} onDepart={onDepart} departing={departing} error={travelError} />
      <p className="control-hint">
        Arrow keys: steer and change speed. Comma/period: zoom out/in. When equipped,
        Space fires the primary weapon at a selected ship. Select a system below to view its travel estimate.
      </p>
  </>;
  return <Presentation key={viewKey} definition={gameModule.definition} hud={hud}
    target={target} onClearTarget={onClearTarget}
    planetContact={planetContact} selectedContact={selectedContact}
    viewport={viewport} sliceTools={sliceTools} saveTools={saveTools}
    onReturnToMenu={returnToMenu} onInputAvailabilityChange={onInputAvailabilityChange} />;
}
