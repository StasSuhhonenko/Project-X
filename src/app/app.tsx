/** React scene composition and lifecycle for the current playable slice.
 *
 * Scene transitions are host-owned: selecting a world (start, load, restart) is
 * immediate, but the new scene mounts invisibly beneath the previous screen and
 * is revealed in one step once its presentation and first spatial frame are
 * ready (see scene-reveal.ts). The previous screen stays complete meanwhile. */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { GameModule } from '../content/game-module';
import { createBrowserAudioCue } from '../platform/browser/browser-audio-cue';
import { createBrowserSimulationLifecycle } from '../platform/browser/browser-simulation-lifecycle';
import { createKeyboardControls, type KeyboardControls } from '../platform/keyboard/keyboard-controls';
import type { SpatialPresentation, SpatialStill, SpatialView } from '../rendering/contracts/spatial-presentation';
import { IDLE_PLAYER_CONTROLS } from '../simulation/commands/player-controls';
import { selectPlayerEntity } from '../simulation/model/world-state';
import { createActorDeathSource } from '../ui/actor-death-source';
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
import { selectFleetInputs, selectFleetView } from '../ui/fleet-view';
import { selectGameHudView } from '../ui/game-hud-selector';
import { GameViewport } from '../ui/game-viewport';
import type { GameplayPresentation, PresentationReadiness } from '../ui/gameplay-presentation';
import { selectMissionInputs, selectMissionView } from '../ui/mission-view';
import type { GameplayClient } from '../ui/module-client';
import { PlayerDeathScreen } from '../ui/player-death-screen';
import { selectProgressionView } from '../ui/progression-view';
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
import { createMissionIntents } from './mission-intent';
import { createPurchaseIntent } from './purchase-intent';
import { createRouteIntents } from './route-intent';
import { createScenePreparation } from './scene-preparation';
import { createSceneRevealGate, type SceneRevealGate } from './scene-reveal';
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
  // Background warmup once the entry is complete. It never mounts a scene, and
  // a failure stays silent here because an explicit start retries the loader.
  const warmed = useRef(false);
  const onEntryPrepared = useCallback(() => {
    if (warmed.current || !loadGameplay) return;
    warmed.current = true;
    void loadGameplay().catch(() => {
      warmed.current = false;
    });
  }, [loadGameplay]);
  const [terminalBackdrop, setTerminalBackdrop] = useState<TerminalBackdrop | null>(null);
  // The last complete in-game image covers an in-game load or a restart until
  // the replacement scene is revealed. It is a still; no live scene survives.
  const [transitionCover, setTransitionCover] = useState<TransitionCover | null>(null);
  const terminalCover = useRef<TransitionCover | null>(null);
  terminalCover.current = terminalBackdrop ? { image: terminalBackdrop.image } : null;
  useEffect(() => {
    if (screen === 'game' && terminalCover.current) setTransitionCover(terminalCover.current);
    setTerminalBackdrop(null);
  }, [sessionRevision, screen]);
  // One gate per session revision, scene attempt and client (see scene-reveal.ts).
  const [sceneAttempt, setSceneAttempt] = useState(0);
  const gateKey = `${sessionRevision}:${sceneAttempt}:${client ? 'client' : 'none'}`;
  const gates = useRef<{ readonly key: string; readonly gate: SceneRevealGate } | null>(null);
  if (gates.current?.key !== gateKey) gates.current = { key: gateKey, gate: createSceneRevealGate() };
  const gate = gates.current.gate;
  const reveal = useSyncExternalStore(gate.subscribe, gate.getSnapshot, gate.getSnapshot);
  // A terminal session is plain DOM over a still image and needs no preparation.
  const revealed = screen === 'game' && (worldStatus === 'player-destroyed' || reveal.phase === 'revealed');
  const transitioning = screen === 'game' && !revealed;
  // Where the player came from decides what stays visible during preparation.
  const origin = useRef<'menu' | 'game'>('menu');
  if (screen === 'main-menu') origin.current = 'menu';
  if (revealed) origin.current = 'game';
  useEffect(() => {
    if (revealed || screen === 'main-menu') setTransitionCover(null);
  }, [revealed, screen]);
  const startGame = useMemo(() => createEntryStartIntent(store, sessionRevision), [store, sessionRevision]);
  const returnToMenu = useAppStore(state => state.returnToMenu);
  // Cancel affects only the session it was offered for; a replacement session
  // published meanwhile keeps its own transition.
  const cancelTransition = useCallback(() => {
    const state = store.getState();
    if (state.screen === 'game' && state.sessionRevision === sessionRevision) returnToMenu();
  }, [store, sessionRevision, returnToMenu]);
  const retryTransition = useCallback(() => {
    if (clientError) {
      setClientAttempt(value => value + 1);
      return;
    }
    setSceneAttempt(value => value + 1);
  }, [clientError]);
  const saveTools = useSavePanel({ store, gameModule, canSave: screen === 'game' && worldStatus === 'active' });
  const showEntry = screen === 'main-menu' || (transitioning && origin.current === 'menu');
  const coverImage = transitionCover ?? terminalCover.current;
  return (
    <div className="app-shell">
      {/* One stable slot keeps the entry mounted (drafts, focus, controller
          state) while it covers a preparing scene; only its layer changes. */}
      <div
        className={transitioning ? 'app-transition-layer' : 'app-entry-layer'}
        inert={transitioning}
        aria-hidden={transitioning || undefined}
      >
        {showEntry && (
          <Entry
            definition={gameModule.definition}
            onStart={startGame}
            saveTools={transitioning ? null : saveTools}
            onPrepared={onEntryPrepared}
          />
        )}
        {transitioning && !showEntry && <TransitionStill cover={coverImage} />}
      </div>
      {transitioning && (
        <SceneTransitionStatus
          key={`${sessionRevision}:${sceneAttempt}:${clientAttempt}`}
          error={clientError ?? reveal.error}
          onRetry={retryTransition}
          onCancel={cancelTransition}
        />
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
        <div
          className="app-scene"
          data-scene-revealed={revealed}
          inert={!revealed}
          aria-hidden={!revealed || undefined}
        >
          <GameSceneErrorBoundary
            key={`${sessionRevision}:${sceneAttempt}`}
            onReturnToMenu={returnToMenu}
            saveTools={saveTools}
          >
            <GameScene
              store={store}
              gameModule={gameModule}
              gameplayPresentation={client.GameplayPresentation}
              spatial={client.spatial}
              saveTools={saveTools}
              onTerminalBackdrop={setTerminalBackdrop}
              onTransitionCover={setTransitionCover}
              revealed={revealed}
              revealGate={gate}
            />
          </GameSceneErrorBoundary>
        </div>
      )}
    </div>
  );
}

/** What covers a preparing in-game replacement: the decoded terminal backdrop,
 * or a canvas copy of the previous view placed exactly where it was. */
type TransitionCover = { readonly image: string } | { readonly still: SpatialStill };

function TransitionStill({ cover }: { readonly cover: TransitionCover | null }) {
  // A canvas displays synchronously; attaching the detached copy avoids the
  // asynchronous image decode that would otherwise leave one blank frame.
  const attach = useCallback(
    (host: HTMLDivElement | null) => {
      if (!host || !cover || !('still' in cover)) return;
      const { image, bounds } = cover.still;
      Object.assign(image.style, {
        position: 'fixed',
        left: `${bounds.x}px`,
        top: `${bounds.y}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
      });
      host.replaceChildren(image);
    },
    [cover]
  );
  if (cover && 'image' in cover)
    return (
      <div className="app-transition-still">
        <img src={cover.image} alt="" />
      </div>
    );
  return <div className="app-transition-still" ref={attach} />;
}

/** Busy feedback appears only when preparation takes noticeable time, so a warm
 * start reveals directly. Failures show at once with retry and cancel. */
export const SCENE_TRANSITION_STATUS_DELAY_MS = 300;

function SceneTransitionStatus({
  error,
  onRetry,
  onCancel,
}: {
  readonly error: string | null;
  readonly onRetry: () => void;
  readonly onCancel: () => void;
}) {
  const [due, setDue] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDue(true), SCENE_TRANSITION_STATUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!error && !due) return null;
  return (
    <div className="app-transition-status" role={error ? 'alert' : 'status'}>
      <span>{error ? `The game could not be prepared: ${error}` : 'Preparing game…'}</span>
      {error && <button onClick={onRetry}>Retry</button>}
      <button onClick={onCancel}>{error ? 'Return to menu' : 'Cancel'}</button>
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
  onTransitionCover,
  spatial,
  revealed,
  revealGate,
}: {
  readonly spatial: SpatialPresentation;
  readonly store: AppStore;
  readonly gameModule: GameModule;
  readonly gameplayPresentation: GameplayPresentation;
  readonly saveTools: ReactNode;
  readonly onTerminalBackdrop: (backdrop: TerminalBackdrop) => void;
  /** Receives a still of this scene when another session replaces it in-game. */
  readonly onTransitionCover: (cover: TransitionCover) => void;
  /** False while this scene prepares invisibly; no ticks or input until true. */
  readonly revealed: boolean;
  readonly revealGate: SceneRevealGate;
}) {
  const viewRef = useRef<SpatialView | null>(null);
  const keyboardRef = useRef<KeyboardControls | null>(null);
  // Flight input requires both presentation availability and a revealed scene.
  const inputAvailableRef = useRef(false);
  const presentationInputRef = useRef(false);
  // Read by the frame loop; the latest committed value is the one that counts.
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  const onInputAvailabilityChange = useCallback((available: boolean) => {
    presentationInputRef.current = available;
    inputAvailableRef.current = available && revealedRef.current;
    keyboardRef.current?.reset();
  }, []);
  useEffect(() => {
    inputAvailableRef.current = presentationInputRef.current && revealed;
    // Keys pressed over the previous screen must not steer the revealed ship.
    keyboardRef.current?.reset();
  }, [revealed]);
  const onPresentationReadyChange = useCallback(
    (readiness: PresentationReadiness) => revealGate.reportPresentation(readiness),
    [revealGate]
  );
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
  const fleetInputs = useAppStore(useShallow(selectFleetInputs));
  const fleetView = useMemo(
    () => (fleetInputs ? selectFleetView(store.getState(), gameModule) : null),
    [store, gameModule, fleetInputs]
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
  const actorDeathSource = useMemo(() => createActorDeathSource(spatialSource), [spatialSource]);
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
  const progression = useAppStore(useShallow(selectProgressionView));
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
  const missionInputs = useAppStore(useShallow(selectMissionInputs));
  const missions = useMemo(
    () => (missionInputs ? selectMissionView(store.getState(), gameModule) : null),
    [store, gameModule, missionInputs]
  );
  const missionIntents = useMemo(
    () => createMissionIntents(store, missions, sessionRevision),
    [store, missions, sessionRevision]
  );
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
  const onPlayCommunicationCue = useMemo(() => {
    const play = communicationCue.intent(communication?.sequence ?? null);
    // No gameplay audio while the scene is still hidden beneath another screen.
    return (sequence: number) => {
      if (revealedRef.current) play(sequence);
    };
  }, [communicationCue, communication?.sequence]);
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
      if (!revealedRef.current) revealGate.reportFailure(error);
      if (vesselPurchase.isBusy() && hud) {
        vesselPurchase.onViewError(error, hud.playerDefinitionId);
        return;
      }
      travelLifecycle.onViewError(error, viewKey);
    },
    [travelLifecycle, vesselPurchase, hud?.playerDefinitionId, viewKey, revealGate]
  );
  // Capture a still synchronously when a replacement session is published while
  // the game screen stays up, so the cover is complete in the very first commit.
  useEffect(
    () =>
      store.subscribe(state => {
        if (state.screen !== 'game' || state.sessionRevision === sessionRevision || !revealedRef.current) return;
        try {
          const still = viewRef.current?.captureStill?.();
          if (still) onTransitionCover({ still });
        } catch {
          // A missing still only means a plain cover; the transition proceeds.
        }
      }),
    [store, sessionRevision, onTransitionCover]
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
        // A hidden scene renders but never advances: no idle ticks before reveal.
        if (!revealedRef.current || travelLifecycle.isBusy() || vesselPurchase.isBusy()) return;
        store
          .getState()
          .advanceWorld(inputAvailableRef.current && viewRef.current ? keyboard.sample() : IDLE_PLAYER_CONTROLS);
      },
      render: (alpha, timeMs) => {
        const view = viewRef.current;
        if (!view) return;
        view.render(alpha, {
          timeMs,
          worldFrozen: !revealedRef.current || travelLifecycle.isBusy() || vesselPurchase.isBusy(),
          continueBackdrop: travelLifecycle.shouldHidePlayer(),
        });
        // A completed frame of the attached view is one of the two reveal facts.
        if (!revealedRef.current) revealGate.reportFirstFrame();
      },
      onError: error => {
        if (!revealedRef.current) revealGate.reportFailure(error);
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
  }, [store, gameModule, travelLifecycle, vesselPurchase, sessionRevision, onTerminalBackdrop, scenes, revealGate]);

  if (frameFailure) throw frameFailure.error;
  if (!hud || !repair) return null;
  const runFleetCommand = (command: () => boolean): boolean => {
    const state = store.getState();
    if (
      !inputAvailableRef.current ||
      travelLifecycle.isBusy() ||
      vesselPurchase.isBusy() ||
      state.sessionRevision !== sessionRevision ||
      !state.world ||
      selectPlayerEntity(state.world).location.systemId !== hud.systemId
    )
      return false;
    return command();
  };
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
      progression={progression}
      communication={communication}
      onPlayCommunicationCue={onPlayCommunicationCue}
      onClearTarget={onClearTarget}
      planetContact={planetContact}
      selectedContact={selectedContact}
      worldActivation={worldActivation}
      spatialOverview={spatialOverview}
      actorDeathSource={actorDeathSource}
      repair={repair}
      playerSpatial={playerSpatial}
      onBeginRepair={onBeginRepair}
      onCancelRepair={onCancelRepair}
      purchase={purchase}
      onPurchaseCargo={onPurchaseCargo}
      cargoHold={cargoHold}
      commodityMarket={commodityMarket}
      missions={missions}
      onAcceptContract={ref =>
        inputAvailableRef.current &&
        !vesselPurchase.isBusy() &&
        !travelLifecycle.isBusy() &&
        missionIntents.acceptContract(ref)
      }
      onNegotiateContract={ref =>
        inputAvailableRef.current &&
        !vesselPurchase.isBusy() &&
        !travelLifecycle.isBusy() &&
        missionIntents.negotiateContract(ref)
      }
      onTransportToSurface={() =>
        inputAvailableRef.current &&
        !vesselPurchase.isBusy() &&
        !travelLifecycle.isBusy() &&
        missionIntents.transportToSurface()
      }
      onCargoTrade={intent => {
        if (!inputAvailableRef.current || vesselPurchase.isBusy() || travelLifecycle.isBusy()) return 'unavailable';
        return onCargoTrade(intent);
      }}
      resourceSales={resourceSales}
      {...(gameModule.rules.resolveTextCommand
        ? {
            onSubmitTextCommand: intent => {
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
              return state.submitTextCommand(intent);
            },
          }
        : {})}
      onPurchaseResource={
        gameModule.rules.quoteResourcePurchase
          ? intent => {
              const state = store.getState();
              if (
                !inputAvailableRef.current ||
                vesselPurchase.isBusy() ||
                travelLifecycle.isBusy() ||
                state.sessionRevision !== sessionRevision ||
                !state.world ||
                selectPlayerEntity(state.world).location.systemId !== hud.systemId
              )
                return null;
              return state.purchaseResource(intent);
            }
          : undefined
      }
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
      fleet={fleetView}
      onSelectTarget={onSelectTarget}
      onIssueFleetOrder={intent => runFleetCommand(() => store.getState().issueFleetOrder(intent))}
      onSetFleetMission={intent => runFleetCommand(() => store.getState().setFleetMission(intent))}
      onLaunchStowedFleet={intent => runFleetCommand(() => store.getState().launchStowedFleet(intent))}
      onRecallFleet={intent => runFleetCommand(() => store.getState().recallFleet(intent))}
      onPublishFleetNotice={message => runFleetCommand(() => store.getState().publishFleetNotice(message))}
      fleetBusy={vesselPurchaseView.fleetBusy}
      fleetMessage={vesselPurchaseView.fleetMessage}
      onAcquireFleetShip={intent => {
        if (inputAvailableRef.current && !travelLifecycle.isBusy()) vesselPurchase.acquireFleet(intent);
      }}
      onReleaseFleetShip={intent => {
        if (!inputAvailableRef.current || travelLifecycle.isBusy() || vesselPurchase.isBusy()) return false;
        return store.getState().releaseFleetShip(intent);
      }}
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
      revealed={revealed}
      onPresentationReadyChange={onPresentationReadyChange}
    />
  );
}
