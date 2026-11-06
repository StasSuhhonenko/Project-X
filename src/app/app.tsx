/** React scene composition and lifecycle for the current playable slice. */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { GameModule } from '../content/game-module';
import { createBrowserAudioCue } from '../platform/browser/browser-audio-cue';
import { createBrowserSimulationLifecycle } from '../platform/browser/browser-simulation-lifecycle';
import { createKeyboardControls, type KeyboardControls } from '../platform/keyboard/keyboard-controls';
import type { SpatialPresentation, SpatialView } from '../rendering/contracts/spatial-presentation';
import { IDLE_PLAYER_CONTROLS } from '../simulation/commands/player-controls';
import { selectPlayerEntity } from '../simulation/model/world-state';
import {
  selectCargoHoldView,
  selectCommerceInputs,
  selectCommodityMarketView,
  selectResourceSalesView,
} from '../ui/cargo-trade-view';
import { selectCommunicationView } from '../ui/communication-selector';
import { selectPlanetContactView, selectSelectedContactView } from '../ui/contact-selector';
import type { EntryPresentation } from '../ui/entry-presentation';
import { selectEquipmentView } from '../ui/equipment-view';
import { selectGameHudView } from '../ui/game-hud-selector';
import { GameViewport } from '../ui/game-viewport';
import type { GameplayPresentation } from '../ui/gameplay-presentation';
import type { GameplayClient } from '../ui/module-client';
import { PlayerDeathScreen } from '../ui/player-death-screen';
import { selectPurchaseView } from '../ui/purchase-selector';
import { selectRepairView } from '../ui/repair-selector';
import { selectRouteView } from '../ui/route-selector';
import { useSavePanel } from '../ui/save-panel';
import { selectSelectedTargetView } from '../ui/selected-target-selector';
import { selectSpatialOverview, WorldActivationSchema, type WorldActivation } from '../ui/spatial-overview-view';
import { selectSystemStandingView } from '../ui/system-standing-view';
import type { TerminalPresentation } from '../ui/terminal-presentation';
import { TravelPresentationOptionsSchema } from '../ui/travel-presentation-view';
import { selectVesselOffers } from '../ui/vessel-purchase-view';
import type { AppStore } from './app-store';
import { useAppStore } from './app-store-context';
import { createCargoTradeIntent } from './cargo-trade-intent';
import { createCommunicationCueLifetime } from './communication-cue-intent';
import { createEntryStartIntent } from './entry-start-intent';
import { GameSceneErrorBoundary } from './game-scene-error-boundary';
import { createPurchaseIntent } from './purchase-intent';
import { createRouteIntents } from './route-intent';
import { createScenePreparation } from './scene-preparation';
import {
  captureTerminalBackdrop,
  createTerminalIntents,
  selectTerminalView,
  type TerminalBackdrop,
} from './terminal-presentation';
import { createTravelLifecycle } from './travel-lifecycle';
import { createTravelDismissIntent } from './travel-presentation';
import { createVesselPurchaseLifecycle } from './vessel-purchase-lifecycle';

type AppProps = {
  readonly store: AppStore;
  readonly gameModule: GameModule;
  readonly entryPresentation: EntryPresentation;
} & (
  | { readonly loadGameplay: () => Promise<GameplayClient> }
  | {
      /** Prepared injection remains useful for embedded hosts and renderer-free tests. */
      readonly spatial: SpatialPresentation;
      readonly gameplayPresentation: GameplayPresentation;
      readonly terminalPresentation?: TerminalPresentation | undefined;
    }
);

/** Connect the selected entry to validated commands and host save operations. */
export function App(props: AppProps) {
  const { store, gameModule, entryPresentation: Entry } = props;
  const loadGameplay = 'loadGameplay' in props ? props.loadGameplay : null;
  const [client, setClient] = useState<GameplayClient | null>(() =>
    'spatial' in props
      ? {
          spatial: props.spatial,
          GameplayPresentation: props.gameplayPresentation,
          TerminalPresentation: props.terminalPresentation,
        }
      : null
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const [clientAttempt, setClientAttempt] = useState(0);
  const screen = useAppStore(state => state.screen);
  const worldStatus = useAppStore(state => state.world?.status ?? null);
  const sessionRevision = useAppStore(state => state.sessionRevision);
  // No scene, scheduler or input service mounts until preparation succeeds.
  // Leaving/replacing a session invalidates its callback, while the selected
  // module retains a successful prepared client for a later start or restore.
  useEffect(() => {
    if (screen !== 'game' || client || !loadGameplay) return;
    let current = true;
    setClientError(null);
    void loadGameplay().then(
      loaded => {
        if (current) setClient(loaded);
      },
      error => {
        if (current) setClientError(error instanceof Error ? error.message : String(error));
      }
    );
    return () => {
      current = false;
    };
  }, [screen, sessionRevision, client, loadGameplay, clientAttempt]);
  const [terminalBackdrop, setTerminalBackdrop] = useState<TerminalBackdrop | null>(null);
  useEffect(() => {
    setTerminalBackdrop(null);
  }, [sessionRevision, screen]);
  const startGame = useMemo(() => createEntryStartIntent(store, sessionRevision), [store, sessionRevision]);
  const returnToMenu = useAppStore(state => state.returnToMenu);
  const saveTools = useSavePanel({ store, gameModule, canSave: screen === 'game' && worldStatus === 'active' });
  return (
    <div className="app-shell">
      {screen === 'main-menu' && <Entry definition={gameModule.definition} onStart={startGame} saveTools={saveTools} />}
      {screen === 'game' && !client && (
        <>
          <main className="startup-failure" role={clientError ? 'alert' : 'status'}>
            <p>{clientError ? `The game presentation could not load: ${clientError}` : 'Loading game presentation…'}</p>
            {clientError && (
              <button onClick={() => setClientAttempt(value => value + 1)}>Retry game presentation</button>
            )}
            <button onClick={returnToMenu}>Return to menu</button>
          </main>
          {saveTools}
        </>
      )}
      {screen === 'game' && client && worldStatus === 'player-destroyed' && (
        <GameSceneErrorBoundary key={`terminal-${sessionRevision}`} onReturnToMenu={returnToMenu} saveTools={saveTools}>
          <TerminalScene
            store={store}
            gameModule={gameModule}
            presentation={client.TerminalPresentation ?? PlayerDeathScreen}
            spatial={client.spatial}
            backdrop={terminalBackdrop}
            saveTools={saveTools}
          />
        </GameSceneErrorBoundary>
      )}
      {screen === 'game' && client && worldStatus !== 'player-destroyed' && (
        <GameSceneErrorBoundary key={sessionRevision} onReturnToMenu={returnToMenu} saveTools={saveTools}>
          <GameScene
            store={store}
            gameModule={gameModule}
            gameplayPresentation={client.GameplayPresentation}
            spatial={client.spatial}
            saveTools={saveTools}
            onTerminalBackdrop={setTerminalBackdrop}
          />
        </GameSceneErrorBoundary>
      )}
    </div>
  );
}

/** A separate subtree ensures death disposes every active gameplay service first. */
function TerminalScene({
  store,
  gameModule,
  presentation: Presentation,
  saveTools,
  backdrop,
  spatial,
}: {
  readonly spatial: SpatialPresentation;
  readonly store: AppStore;
  readonly gameModule: GameModule;
  readonly presentation: TerminalPresentation;
  readonly saveTools: ReactNode;
  readonly backdrop: TerminalBackdrop | null;
}) {
  const [startedAtMs] = useState(() => performance.now());
  const world = useAppStore(state => state.world);
  const sessionRevision = useAppStore(state => state.sessionRevision);
  const terminal = useMemo(
    () => selectTerminalView(store.getState(), gameModule, startedAtMs, spatial.projectPlayer),
    [store, gameModule, startedAtMs, world, sessionRevision, spatial]
  );
  const intents = useMemo(
    () => (world ? createTerminalIntents(store, world, sessionRevision) : null),
    [store, world, sessionRevision]
  );
  if (!terminal || !intents) return null;
  return (
    <Presentation
      definition={gameModule.definition}
      terminal={terminal}
      backdrop={
        backdrop?.world === world && backdrop.sessionRevision === sessionRevision ? (
          <img src={backdrop.image} alt="" style={{ width: '100%', height: '100%' }} />
        ) : null
      }
      onReturnToMenu={intents.onReturnToMenu}
      onRestart={intents.onRestart}
      saveTools={saveTools}
    />
  );
}

/**
 * Owns services whose lifetime is exactly one active game scene. Unmounting the
 * scene removes keyboard listeners, stops animation scheduling, and lets the
 * viewport dispose its Pixi resources independently.
 */
function GameScene({
  store,
  gameModule,
  gameplayPresentation: Presentation,
  saveTools,
  onTerminalBackdrop,
  spatial,
}: {
  readonly spatial: SpatialPresentation;
  readonly store: AppStore;
  readonly gameModule: GameModule;
  readonly gameplayPresentation: GameplayPresentation;
  readonly saveTools: ReactNode;
  readonly onTerminalBackdrop: (backdrop: TerminalBackdrop) => void;
}) {
  const viewRef = useRef<SpatialView | null>(null);
  const keyboardRef = useRef<KeyboardControls | null>(null);
  const inputAvailableRef = useRef(false);
  const onInputAvailabilityChange = useCallback((available: boolean) => {
    inputAvailableRef.current = available;
    keyboardRef.current?.reset();
  }, []);
  const resetInput = useCallback(() => keyboardRef.current?.reset(), []);
  const scenes = useMemo(() => createScenePreparation(spatial, store.getState), [spatial, store]);
  const travelOptions = useMemo(
    () => TravelPresentationOptionsSchema.parse(Presentation.travelPresentation ?? { departureDurationMs: 0 }),
    [Presentation]
  );
  const travelLifecycle = useMemo(
    () => createTravelLifecycle(store, gameModule, travelOptions, resetInput, scenes),
    [store, gameModule, travelOptions, resetInput, scenes]
  );
  const vesselPurchase = useMemo(
    () => createVesselPurchaseLifecycle(store, gameModule, resetInput, scenes.prepare),
    [store, gameModule, resetInput, scenes]
  );
  const vesselPurchaseView = useSyncExternalStore(
    vesselPurchase.subscribe,
    vesselPurchase.getSnapshot,
    vesselPurchase.getSnapshot
  );
  const travelView = useSyncExternalStore(
    travelLifecycle.subscribe,
    travelLifecycle.getSnapshot,
    travelLifecycle.getSnapshot
  );
  const {
    travel,
    phase: travelPhase,
    error: travelError,
    errorKind: routeErrorKind,
    errorRevision: routeErrorRevision,
  } = travelView;
  const [frameFailure, setFrameFailure] = useState<{ readonly error: unknown } | null>(null);
  const [worldActivation, setWorldActivation] = useState<WorldActivation | null>(null);
  // Pointer navigation belongs to the scene that received it. A preload, failed
  // arrival or rollback must not replay the old click in a replacement view.
  useEffect(() => {
    if (travelPhase !== 'ready') setWorldActivation(null);
  }, [travelPhase]);
  const overviewWorld = useAppStore(state => state.world);
  const vesselOffers = useMemo(
    () => selectVesselOffers(store.getState(), gameModule),
    [store, gameModule, overviewWorld]
  );
  const equipment = useMemo(
    () => selectEquipmentView(store.getState(), gameModule),
    [store, gameModule, overviewWorld]
  );
  const spatialOverview = useMemo(() => selectSpatialOverview(store.getState()), [store, overviewWorld]);
  const onWorldActivate = useCallback(
    (
      contact: {
        readonly id: string;
        readonly kind: 'planet' | 'station' | 'npc-ship';
        readonly selectedBefore: boolean;
      } | null
    ) => {
      if (!contact || !inputAvailableRef.current || vesselPurchase.isBusy()) return;
      const world = store.getState().world;
      if (
        !world ||
        world.status !== 'active' ||
        !world.entities.some(entity => entity.id === contact.id && entity.kind === contact.kind)
      )
        return;
      setWorldActivation(previous =>
        WorldActivationSchema.parse({ ...contact, sequence: (previous?.sequence ?? 0) + 1 })
      );
    },
    [store, vesselPurchase]
  );
  const spatialSource = useMemo(
    () => ({
      getState: () => ({ world: store.getState().world, sessionRevision: store.getState().sessionRevision }),
      subscribe: (
        listener: (state: {
          readonly world: import('../simulation/model/world-state').WorldState | null;
          readonly sessionRevision: number;
        }) => void
      ) => store.subscribe(state => listener({ world: state.world, sessionRevision: state.sessionRevision })),
    }),
    [store]
  );
  const onSelectTarget = useCallback(
    (id: string | null) => {
      if (!inputAvailableRef.current || vesselPurchase.isBusy() || travelLifecycle.isBusy()) return;
      store.getState().selectTarget(id);
    },
    [store, vesselPurchase, travelLifecycle]
  );
  const hud = useAppStore(useShallow(selectGameHudView));
  const identity = useAppStore(state => (state.world ? selectPlayerEntity(state.world).identity : null));
  const target = useAppStore(useShallow(selectSelectedTargetView));
  const standing = useAppStore(useShallow(selectSystemStandingView));
  const communication = useAppStore(useShallow(selectCommunicationView));
  const planetContact = useAppStore(useShallow(state => selectPlanetContactView(state, gameModule.definition)));
  const selectedContact = useAppStore(useShallow(selectSelectedContactView));
  const repair = useAppStore(useShallow(state => selectRepairView(state, gameModule)));
  const purchase = useAppStore(useShallow(state => selectPurchaseView(state, gameModule)));
  const commerceInputs = useAppStore(useShallow(selectCommerceInputs));
  const commodityMarket = useMemo(
    () => selectCommodityMarketView(store.getState(), gameModule),
    [store, gameModule, commerceInputs]
  );
  const cargoPods = useAppStore(state => (state.world ? selectPlayerEntity(state.world).inventory.cargo : null));
  const cargoHold = useMemo(
    () => selectCargoHoldView(store.getState(), gameModule),
    [store, gameModule, cargoPods, hud?.playerDefinitionId]
  );
  const resourceSales = useMemo(
    () => selectResourceSalesView(store.getState(), gameModule),
    [store, gameModule, hud?.systemId, hud?.positionX, hud?.positionY, hud?.zoom, hud?.resources, hud?.repairing]
  );
  const route = useAppStore(state => selectRouteView(state, gameModule));
  const sessionRevision = useAppStore(state => state.sessionRevision);
  const onCargoTrade = useMemo(
    () => createCargoTradeIntent(store, commodityMarket, sessionRevision),
    [store, commodityMarket, sessionRevision]
  );
  const onPurchaseCargo = useMemo(
    () => createPurchaseIntent(store, purchase, sessionRevision),
    [store, purchase, sessionRevision]
  );
  const playerSpatial = useAppStore(useShallow(state => (state.world ? scenes.projectPlayer(state.world) : null)));
  const onBeginRepair = useAppStore(state => state.beginRepair);
  const onCancelRepair = useAppStore(state => state.cancelRepair);
  const onClearTarget = useCallback(() => store.getState().selectTarget(null), [store]);
  const returnToMenu = useAppStore(state => state.returnToMenu);
  useEffect(() => {
    viewRef.current?.setPlayerVisible?.(!travelLifecycle.shouldHidePlayer());
  }, [travelLifecycle, travelView]);
  const viewKey = useAppStore(state => (state.world ? selectPlayerEntity(state.world).location.systemId : 'empty'));
  const communicationCue = useMemo(
    () =>
      createCommunicationCueLifetime(
        store,
        sessionRevision,
        typeof viewKey === 'number' ? viewKey : null,
        () =>
          createBrowserAudioCue(
            gameModule.definition.audio?.communication ? `/game/${gameModule.definition.audio.communication}` : null
          ),
        travelLifecycle.isBusy
      ),
    [store, sessionRevision, viewKey, gameModule, travelLifecycle]
  );
  const onPlayCommunicationCue = useMemo(
    () => communicationCue.intent(communication?.sequence ?? null),
    [communicationCue, communication?.sequence]
  );
  useEffect(() => {
    communicationCue.activate();
    return () => communicationCue.deactivate();
  }, [communicationCue]);
  const onViewReady = useCallback(
    (view: SpatialView | null) => {
      viewRef.current = view;
      view?.setPlayerVisible?.(!travelLifecycle.shouldHidePlayer());
      resetInput();
      if (view) {
        travelLifecycle.onViewReady(viewKey);
        if (hud) vesselPurchase.onViewReady(hud.playerDefinitionId);
      }
    },
    [travelLifecycle, vesselPurchase, hud?.playerDefinitionId, viewKey, resetInput]
  );
  const onViewError = useCallback(
    (error: Error) => {
      if (vesselPurchase.isBusy() && hud) {
        vesselPurchase.onViewError(error, hud.playerDefinitionId);
        return;
      }
      travelLifecycle.onViewError(error, viewKey);
    },
    [travelLifecycle, vesselPurchase, hud?.playerDefinitionId, viewKey]
  );
  const onDismissTravel = useMemo(
    () =>
      createTravelDismissIntent(
        store,
        travel,
        sessionRevision,
        () => travelLifecycle.getSnapshot().travel,
        travelLifecycle.isArriving,
        travelLifecycle.dismiss
      ),
    [travel, store, sessionRevision, travelLifecycle]
  );
  const routeIntents = useMemo(
    () =>
      createRouteIntents(
        store,
        route,
        sessionRevision,
        () => travelLifecycle.isBusy() || vesselPurchase.isBusy(),
        travelLifecycle.depart
      ),
    [store, route, sessionRevision, travelLifecycle, vesselPurchase]
  );
  const onPurchaseVessel = useCallback<ReturnType<typeof createVesselPurchaseLifecycle>['purchase']>(
    intent => {
      if (!travelLifecycle.isBusy()) vesselPurchase.purchase(intent);
    },
    [travelLifecycle, vesselPurchase]
  );
  useEffect(() => {
    travelLifecycle.activate();
    vesselPurchase.activate();
    const keyboard = createKeyboardControls();
    keyboardRef.current = keyboard;
    const simulation = createBrowserSimulationLifecycle({
      framesPerSecond: gameModule.definition.framesPerSecond,
      update: () => {
        if (travelLifecycle.isBusy() || vesselPurchase.isBusy()) return;
        store
          .getState()
          .advanceWorld(inputAvailableRef.current && viewRef.current ? keyboard.sample() : IDLE_PLAYER_CONTROLS);
      },
      render: (alpha, timeMs) =>
        viewRef.current?.render(alpha, {
          timeMs,
          worldFrozen: travelLifecycle.isBusy() || vesselPurchase.isBusy(),
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
      scenes.cancel();
      simulation.stop();
      keyboard.dispose();
      keyboardRef.current = null;
      // Parent cleanup precedes the viewport child's Pixi disposal. Keep only a
      // frozen image for the terminal actor; no live scene survives this commit.
      const backdrop = captureTerminalBackdrop(store, sessionRevision, viewRef.current);
      if (backdrop) onTerminalBackdrop(backdrop);
    };
  }, [store, gameModule, travelLifecycle, vesselPurchase, sessionRevision, onTerminalBackdrop, scenes]);

  if (frameFailure) throw frameFailure.error;
  if (!hud || !repair) return null;
  const viewport = (
    <GameViewport
      key={`${viewKey}:${hud.playerDefinitionId}:${vesselPurchaseView.viewRevision}`}
      store={spatialSource}
      definition={gameModule.definition}
      onSelectTarget={onSelectTarget}
      onViewReady={onViewReady}
      onViewError={onViewError}
      scenes={scenes}
      onActivate={onWorldActivate}
    />
  );
  const sliceTools = (
    <p className="control-hint">
      Arrow keys: steer and change speed. Comma/period: zoom out/in. When equipped, Space, Z and X fire equipped slots
      1, 2 and 3 at eligible targets. Open the map to select a destination and view its travel estimate.
    </p>
  );
  return (
    <Presentation
      key={viewKey}
      definition={gameModule.definition}
      identity={identity}
      hud={hud}
      target={target}
      standing={standing}
      communication={communication}
      onPlayCommunicationCue={onPlayCommunicationCue}
      onClearTarget={onClearTarget}
      planetContact={planetContact}
      selectedContact={selectedContact}
      worldActivation={worldActivation}
      spatialOverview={spatialOverview}
      repair={repair}
      playerSpatial={playerSpatial}
      onBeginRepair={onBeginRepair}
      onCancelRepair={onCancelRepair}
      purchase={purchase}
      onPurchaseCargo={onPurchaseCargo}
      cargoHold={cargoHold}
      commodityMarket={commodityMarket}
      onCargoTrade={intent => {
        if (!inputAvailableRef.current || vesselPurchase.isBusy() || travelLifecycle.isBusy()) return 'unavailable';
        return onCargoTrade(intent);
      }}
      resourceSales={resourceSales}
      onSellResource={intent => {
        const state = store.getState();
        if (
          !inputAvailableRef.current ||
          vesselPurchase.isBusy() ||
          travelLifecycle.isBusy() ||
          state.sessionRevision !== sessionRevision ||
          !state.world ||
          selectPlayerEntity(state.world).location.systemId !== hud.systemId
        )
          return false;
        return state.sellResource(intent);
      }}
      equipment={equipment}
      onEquipmentCommand={intent => {
        if (inputAvailableRef.current && !vesselPurchase.isBusy() && travelPhase === 'ready')
          store.getState().equipmentCommand(intent);
      }}
      vesselOffers={vesselOffers}
      vesselPurchaseBusy={vesselPurchaseView.busy}
      vesselPurchaseError={vesselPurchaseView.error}
      onPurchaseVessel={onPurchaseVessel}
      route={route}
      routePhase={travelPhase}
      routeError={travelError}
      routeErrorKind={routeErrorKind}
      routeErrorRevision={routeErrorRevision}
      travel={travel}
      onDismissTravel={onDismissTravel}
      onSelectDestination={routeIntents.onSelectDestination}
      onDepart={routeIntents.onDepart}
      onDepartTo={routeIntents.onDepartTo}
      viewport={viewport}
      sliceTools={sliceTools}
      saveTools={saveTools}
      onReturnToMenu={returnToMenu}
      onInputAvailabilityChange={onInputAvailabilityChange}
    />
  );
}
