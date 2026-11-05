import { selectEquipmentView } from '../ui/equipment-view';
/** React scene composition and lifecycle for the current playable slice. */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createEntryStartIntent } from './entry-start-intent';
import { useShallow } from 'zustand/react/shallow';
import { createBrowserSimulationLifecycle } from '../platform/browser/browser-simulation-lifecycle';
import { createKeyboardControls, type KeyboardControls } from '../platform/keyboard/keyboard-controls';
import type { GameplayPresentation } from '../ui/gameplay-presentation';
import { selectGameHudView } from '../ui/game-hud-selector';
import { selectSpatialOverview, WorldActivationSchema, type WorldActivation } from '../ui/spatial-overview-view';
import { selectSelectedTargetView } from '../ui/selected-target-selector';
import { selectSystemStandingView } from '../ui/system-standing-view';
import { selectCommunicationView } from '../ui/communication-selector';
import { createCommunicationCueLifetime } from './communication-cue-intent';
import { createBrowserAudioCue } from '../platform/browser/browser-audio-cue';
import { selectPlanetContactView, selectSelectedContactView } from '../ui/contact-selector';
import { selectRepairView, selectPlayerSpatialView } from '../ui/repair-selector';
import { selectPurchaseView } from '../ui/purchase-selector';
import { createPurchaseIntent } from './purchase-intent';
import { selectRouteView } from '../ui/route-selector';
import { createRouteIntents } from './route-intent';
import { IDLE_PLAYER_CONTROLS } from '../simulation/commands/player-controls';
import { GameSceneErrorBoundary } from './game-scene-error-boundary';
import { GameViewport } from '../ui/game-viewport';
import type { PixiGameView } from '../rendering/pixi-game-view';
import type { EntryPresentation } from '../ui/entry-presentation';
import { PlayerDeathScreen } from '../ui/player-death-screen';
import type { TerminalPresentation } from '../ui/terminal-presentation';
import { captureTerminalBackdrop, createTerminalIntents, selectTerminalView, type TerminalBackdrop } from './terminal-presentation';
import { useSavePanel } from '../ui/save-panel';
import type { GameModule } from '../content/game-module';
import type { AppStore } from './app-store';
import { useAppStore } from './app-store-context';
import { selectPlayerEntity } from '../simulation/model/world-state';
import { createTravelLifecycle } from './travel-lifecycle';
import { createTravelDismissIntent } from './travel-presentation';
import { TravelPresentationOptionsSchema } from '../ui/travel-presentation-view';
import { selectVesselOffers } from '../ui/vessel-purchase-view';
import { createVesselPurchaseLifecycle } from './vessel-purchase-lifecycle';

/** Connect the selected entry to validated commands and host save operations. */
export function App({ store, gameModule, entryPresentation: Entry, gameplayPresentation,
  terminalPresentation = PlayerDeathScreen }: {
  readonly store: AppStore;
  readonly gameModule: GameModule;
  readonly entryPresentation: EntryPresentation;
  readonly gameplayPresentation: GameplayPresentation;
  readonly terminalPresentation?: TerminalPresentation | undefined;
}) {
  const screen = useAppStore(state => state.screen);
  const worldStatus = useAppStore(state => state.world?.status ?? null);
  const sessionRevision = useAppStore(state => state.sessionRevision);
  const [terminalBackdrop, setTerminalBackdrop] = useState<TerminalBackdrop | null>(null);
  useEffect(() => { setTerminalBackdrop(null); }, [sessionRevision, screen]);
  const startGame = useMemo(() => createEntryStartIntent(store, sessionRevision), [store, sessionRevision]);
  const returnToMenu = useAppStore(state => state.returnToMenu);
  const saveTools = useSavePanel({ store, gameModule,
    canSave: screen === 'game' && worldStatus === 'active' });
  return <div className="app-shell">
    {screen === 'main-menu' && <Entry definition={gameModule.definition}
      onStart={startGame} saveTools={saveTools} />}
    {screen === 'game' && worldStatus === 'player-destroyed'
      && <GameSceneErrorBoundary key={`terminal-${sessionRevision}`} onReturnToMenu={returnToMenu} saveTools={saveTools}>
        <TerminalScene store={store} gameModule={gameModule} presentation={terminalPresentation}
          backdrop={terminalBackdrop} saveTools={saveTools} />
      </GameSceneErrorBoundary>}
    {screen === 'game' && worldStatus !== 'player-destroyed'
      && <GameSceneErrorBoundary key={sessionRevision} onReturnToMenu={returnToMenu} saveTools={saveTools}>
        <GameScene store={store} gameModule={gameModule}
          gameplayPresentation={gameplayPresentation} saveTools={saveTools} onTerminalBackdrop={setTerminalBackdrop} />
      </GameSceneErrorBoundary>}
  </div>;
}

/** A separate subtree ensures death disposes every active gameplay service first. */
function TerminalScene({ store, gameModule, presentation: Presentation, saveTools, backdrop }: {
  readonly store: AppStore;
  readonly gameModule: GameModule;
  readonly presentation: TerminalPresentation;
  readonly saveTools: ReactNode;
  readonly backdrop: TerminalBackdrop | null;
}) {
  const [startedAtMs] = useState(() => performance.now());
  const world = useAppStore(state => state.world);
  const sessionRevision = useAppStore(state => state.sessionRevision);
  const terminal = useMemo(() => selectTerminalView(store.getState(), gameModule, startedAtMs),
    [store, gameModule, startedAtMs, world, sessionRevision]);
  const intents = useMemo(() => world ? createTerminalIntents(store, world, sessionRevision) : null,
    [store, world, sessionRevision]);
  if (!terminal || !intents) return null;
  return <Presentation definition={gameModule.definition} terminal={terminal}
    backdrop={backdrop?.world === world && backdrop.sessionRevision === sessionRevision
      ? <img src={backdrop.image} alt="" style={{ width: '100%', height: '100%' }} /> : null}
    onReturnToMenu={intents.onReturnToMenu} onRestart={intents.onRestart} saveTools={saveTools} />;
}

/**
 * Owns services whose lifetime is exactly one active game scene. Unmounting the
 * scene removes keyboard listeners, stops animation scheduling, and lets the
 * viewport dispose its Pixi resources independently.
 */
function GameScene({ store, gameModule, gameplayPresentation: Presentation, saveTools, onTerminalBackdrop }: {
  readonly store: AppStore;
  readonly gameModule: GameModule;
  readonly gameplayPresentation: GameplayPresentation;
  readonly saveTools: ReactNode;
  readonly onTerminalBackdrop: (backdrop: TerminalBackdrop) => void;
}) {
  const viewRef = useRef<PixiGameView | null>(null);
  const keyboardRef = useRef<KeyboardControls | null>(null);
  const inputAvailableRef = useRef(false);
  const onInputAvailabilityChange = useCallback((available: boolean) => {
    inputAvailableRef.current = available;
    keyboardRef.current?.reset();
  }, []);
  const resetInput = useCallback(() => keyboardRef.current?.reset(), []);
  const travelOptions = useMemo(() => TravelPresentationOptionsSchema.parse(
    Presentation.travelPresentation ?? { departureDurationMs: 0 }), [Presentation]);
  const travelLifecycle = useMemo(() => createTravelLifecycle(store, gameModule, travelOptions, resetInput),
    [store, gameModule, travelOptions, resetInput]);
  const vesselPurchase = useMemo(() => createVesselPurchaseLifecycle(store, gameModule, resetInput), [store, gameModule, resetInput]);
  const vesselPurchaseView = useSyncExternalStore(vesselPurchase.subscribe, vesselPurchase.getSnapshot, vesselPurchase.getSnapshot);
  const travelView = useSyncExternalStore(travelLifecycle.subscribe, travelLifecycle.getSnapshot, travelLifecycle.getSnapshot);
  const { travel, phase: travelPhase, error: travelError, errorKind: routeErrorKind, errorRevision: routeErrorRevision } = travelView;
  const [frameFailure, setFrameFailure] = useState<{ readonly error: unknown } | null>(null);
  const [worldActivation, setWorldActivation] = useState<WorldActivation | null>(null);
  // Pointer navigation belongs to the scene that received it. A preload, failed
  // arrival or rollback must not replay the old click in a replacement view.
  useEffect(() => {
    if (travelPhase !== 'ready') setWorldActivation(null);
  }, [travelPhase]);
  const overviewWorld = useAppStore(state => state.world);
  const vesselOffers = useMemo(() => selectVesselOffers(store.getState(), gameModule), [store, gameModule, overviewWorld]);
  const equipment = useMemo(() => selectEquipmentView(store.getState(), gameModule), [store, gameModule, overviewWorld]);
  const spatialOverview = useMemo(() => selectSpatialOverview(store.getState()), [store, overviewWorld]);
  const onWorldActivate = useCallback((contact: { readonly id: string; readonly kind: 'planet' | 'station' | 'npc-ship'; readonly selectedBefore: boolean } | null) => {
    if (!contact || !inputAvailableRef.current || vesselPurchase.isBusy()) return;
    const world = store.getState().world;
    if (!world || world.status !== 'active' || !world.entities.some(entity => entity.id === contact.id && entity.kind === contact.kind)) return;
    setWorldActivation(previous => WorldActivationSchema.parse({ ...contact, sequence: (previous?.sequence ?? 0) + 1 }));
  }, [store, vesselPurchase]);
  const hud = useAppStore(useShallow(selectGameHudView));
  const identity = useAppStore(state => state.world ? selectPlayerEntity(state.world).identity : null);
  const target = useAppStore(useShallow(selectSelectedTargetView));
  const standing = useAppStore(useShallow(selectSystemStandingView));
  const communication = useAppStore(useShallow(selectCommunicationView));
  const planetContact = useAppStore(useShallow(state => selectPlanetContactView(state, gameModule.definition)));
  const selectedContact = useAppStore(useShallow(selectSelectedContactView));
  const repair = useAppStore(useShallow(state => selectRepairView(state, gameModule)));
  const purchase = useAppStore(useShallow(state => selectPurchaseView(state, gameModule)));
  const route = useAppStore(state => selectRouteView(state, gameModule));
  const sessionRevision = useAppStore(state => state.sessionRevision);
  const onPurchaseCargo = useMemo(() => createPurchaseIntent(store, purchase, sessionRevision),
    [store, purchase, sessionRevision]);
  const playerSpatial = useAppStore(useShallow(state => selectPlayerSpatialView(state, gameModule)));
  const onBeginRepair = useAppStore(state => state.beginRepair);
  const onCancelRepair = useAppStore(state => state.cancelRepair);
  const onClearTarget = useCallback(() => store.getState().selectTarget(null), [store]);
  const returnToMenu = useAppStore(state => state.returnToMenu);
  useEffect(() => {
    viewRef.current?.setPlayerVisible(!travelLifecycle.shouldHidePlayer());
  }, [travelLifecycle, travelView]);
  const viewKey = useAppStore(state => state.world
    ? selectPlayerEntity(state.world).location.systemId : 'empty');
  const viewportOptions = useMemo(() => ({
    ...(typeof viewKey === 'number' && Presentation.spatialPresentation
      ? { backgroundImage: Presentation.spatialPresentation.backgroundImageForSystem(viewKey) } : {}),
    ...(typeof viewKey === 'number' && Presentation.spatialPresentation?.parallaxLayersForSystem
      ? { parallaxLayers:Presentation.spatialPresentation.parallaxLayersForSystem(viewKey,
        globalThis.crypto.getRandomValues(new Uint32Array(1))[0]!) } : {}),
    onActivate: onWorldActivate,
  }), [Presentation, viewKey, onWorldActivate]);
  const communicationCue = useMemo(() => createCommunicationCueLifetime(store, sessionRevision,
    typeof viewKey === 'number' ? viewKey : null,
    () => createBrowserAudioCue(gameModule.definition.audio?.communication
      ? `/game/${gameModule.definition.audio.communication}` : null),
    travelLifecycle.isBusy),
  [store, sessionRevision, viewKey, gameModule, travelLifecycle]);
  const onPlayCommunicationCue = useMemo(() => communicationCue.intent(communication?.sequence ?? null),
    [communicationCue, communication?.sequence]);
  useEffect(() => {
    communicationCue.activate();
    return () => communicationCue.deactivate();
  }, [communicationCue]);
  const onViewReady = useCallback((view: PixiGameView | null) => {
    viewRef.current = view;
    view?.setPlayerVisible(!travelLifecycle.shouldHidePlayer());
    resetInput();
    if (view) {
      travelLifecycle.onViewReady(viewKey);
      if (hud) vesselPurchase.onViewReady(hud.playerDefinitionId);
    }
  }, [travelLifecycle, vesselPurchase, hud?.playerDefinitionId, viewKey, resetInput]);
  const onViewError = useCallback((error: Error) => {
    if (vesselPurchase.isBusy() && hud) { vesselPurchase.onViewError(error, hud.playerDefinitionId); return; }
    travelLifecycle.onViewError(error, viewKey);
  }, [travelLifecycle, vesselPurchase, hud?.playerDefinitionId, viewKey]);
  const onDismissTravel = useMemo(() => createTravelDismissIntent(store, travel, sessionRevision,
    () => travelLifecycle.getSnapshot().travel, travelLifecycle.isArriving, travelLifecycle.dismiss),
  [travel, store, sessionRevision, travelLifecycle]);
  const routeIntents = useMemo(() => createRouteIntents(store, route, sessionRevision,
    () => travelLifecycle.isBusy() || vesselPurchase.isBusy(), travelLifecycle.depart), [store, route, sessionRevision, travelLifecycle, vesselPurchase]);
  const onPurchaseVessel = useCallback<ReturnType<typeof createVesselPurchaseLifecycle>['purchase']>(intent => {
    if (!travelLifecycle.isBusy()) vesselPurchase.purchase(intent);
  }, [travelLifecycle, vesselPurchase]);
  useEffect(() => {
    travelLifecycle.activate();
    vesselPurchase.activate();
    const keyboard = createKeyboardControls();
    keyboardRef.current = keyboard;
    const simulation = createBrowserSimulationLifecycle({
      framesPerSecond: gameModule.definition.framesPerSecond,
      update: () => {
        if (travelLifecycle.isBusy() || vesselPurchase.isBusy()) return;
        store.getState().advanceWorld(inputAvailableRef.current && viewRef.current
          ? keyboard.sample() : IDLE_PLAYER_CONTROLS);
      },
      render: (alpha, timeMs) => viewRef.current?.render(alpha, {
        timeMs, worldFrozen: travelLifecycle.isBusy() || vesselPurchase.isBusy(),
        continueBackdrop: travelLifecycle.shouldHidePlayer(),
      }),
      onError: error => {
        keyboard.dispose();
        travelLifecycle.dispose();
        vesselPurchase.dispose();
        // Re-enter React rendering so the existing boundary disposes the whole
        // scene and exposes save/menu recovery for asynchronous frame failures.
        setFrameFailure({ error });
      },
      resetPresentation: () => {
        keyboard.reset();
        viewRef.current?.reset();
      },
    });
    simulation.start();
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      travelLifecycle.dispose();
      vesselPurchase.dispose();
      simulation.stop();
      keyboard.dispose();
      keyboardRef.current = null;
      // Parent cleanup precedes the viewport child's Pixi disposal. Keep only a
      // frozen image for the terminal actor; no live scene survives this commit.
      const backdrop = captureTerminalBackdrop(store, sessionRevision, viewRef.current);
      if (backdrop) onTerminalBackdrop(backdrop);
    };
  }, [store, gameModule, travelLifecycle, vesselPurchase, sessionRevision, onTerminalBackdrop]);

  if (frameFailure) throw frameFailure.error;
  if (!hud || !repair || !playerSpatial) return null;
  const viewport = <GameViewport key={`${viewKey}:${hud.playerDefinitionId}:${vesselPurchaseView.viewRevision}`} store={store} definition={gameModule.definition}
    onViewReady={onViewReady} onViewError={onViewError} options={viewportOptions} />;
  const sliceTools = <p className="control-hint">
    Arrow keys: steer and change speed. Comma/period: zoom out/in. When equipped,
    Space, Z and X fire equipped slots 1, 2 and 3 at eligible targets. Open the map to select a destination and view its travel estimate.
  </p>;
  return <Presentation key={viewKey} definition={gameModule.definition} identity={identity} hud={hud}
    target={target} standing={standing} communication={communication} onPlayCommunicationCue={onPlayCommunicationCue} onClearTarget={onClearTarget}
    planetContact={planetContact} selectedContact={selectedContact}
    worldActivation={worldActivation} spatialOverview={spatialOverview}
    repair={repair} playerSpatial={playerSpatial} onBeginRepair={onBeginRepair} onCancelRepair={onCancelRepair}
    purchase={purchase} onPurchaseCargo={onPurchaseCargo}
    equipment={equipment} onEquipmentCommand={intent => { if (inputAvailableRef.current && !vesselPurchase.isBusy() && travelPhase === 'ready') store.getState().equipmentCommand(intent); }}
    vesselOffers={vesselOffers} vesselPurchaseBusy={vesselPurchaseView.busy} vesselPurchaseError={vesselPurchaseView.error}
    onPurchaseVessel={onPurchaseVessel}
    route={route} routePhase={travelPhase} routeError={travelError} routeErrorKind={routeErrorKind} routeErrorRevision={routeErrorRevision}
    travel={travel} onDismissTravel={onDismissTravel}
    onSelectDestination={routeIntents.onSelectDestination} onDepart={routeIntents.onDepart} onDepartTo={routeIntents.onDepartTo}
    viewport={viewport} sliceTools={sliceTools} saveTools={saveTools}
    onReturnToMenu={returnToMenu} onInputAvailabilityChange={onInputAvailabilityChange} />;
}
