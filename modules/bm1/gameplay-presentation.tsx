/** Source-qualified persistent BM1 frame. Host viewport/commands remain owned
 * by the engine; this module owns authored ink, click routing and HUD navigation.
 * Browser save/menu facilities stay in a collapsed surface outside the stage. */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createBrowserAudioCue } from '@engine/platform/browser/browser-audio-cue';
import { eventHasUiInputOwner } from '@engine/platform/keyboard/ui-input-ownership';
import { inBoardingBeamRange } from './boarding-rules';
import {
  constructionDestinationNames,
  initialConstructionDestination,
  isConstructionDestinationHidden,
  proposeStationName,
} from './construction-rules';
import type { FleetCommand } from './fleet-order-rules';
import type { GameplayPresentationProps } from './presentation-contract';
import { createCheatController } from './ui/cheat/cheat-controller';
import { createCommunicationController } from './ui/communication/communication-controller';
import {
  createConstructionController,
  incompleteStationReport,
  presentConstructionNotice,
} from './ui/construction/construction-controller';
import { ConstructionHud } from './ui/construction/construction-hud';
import { canHailPlanet } from './ui/contact/contact-eligibility';
import { DeferredPanel, type PanelBusyChange } from './ui/deferred-panel';
import { hasUnsupportedSourceGlyph } from './ui/entry/editable-source-input';
import { EquipmentHud } from './ui/equipment/equipment-hud';
import { createFleetManagementController } from './ui/fleet-management/fleet-management-controller';
import { FleetArtwork } from './ui/fleet/fleet-artwork';
import { dispatchFleetCommand, dispatchFleetControl } from './ui/fleet/fleet-commands';
import { fleetReadModel } from './ui/fleet/fleet-read-model';
import { createFleetSelection } from './ui/fleet/fleet-selection';
import { HudArtwork } from './ui/hud/hud-artwork';
import { hudContent } from './ui/hud/hud-content';
import { createHudController, visibleHudInventory } from './ui/hud/hud-controller';
import { HudFrameClock } from './ui/hud/hud-frame-clock';
import { layoutHudText } from './ui/hud/hud-glyphs';
import { createHudReadModel } from './ui/hud/hud-read-model';
import { createIdentityReadModel } from './ui/identity-read-model';
import { createMapController } from './ui/map/map-controller';
import {
  cheatPanel,
  communicationPanel,
  constructionPanel,
  contactPanel,
  fleetManagementPanel,
  navigationPanels,
  repairPanel,
} from './ui/panel-loaders';
import { runtimeAssetUrl } from './ui/runtime-assets';
import { localPrestigeText } from './ui/standing-read-model';
import { createStatusReadModel, fleetStatisticsCount } from './ui/status-read-model';
import { ActorExplosion } from './ui/tactical/actor-explosion';
import { isTacticalDeselectKey } from './ui/tactical/tactical-controller';
import { TacticalPresentation } from './ui/tactical/tactical-presentation';
import { createTacticalReadModel } from './ui/tactical/tactical-read-model';
import { createTransportInput, fleetInputCode } from './ui/transport-input';
import { TRAVEL_DEPARTURE_DURATION_MS } from './ui/travel/departure-policy';
import { useArtwork } from './ui/use-artwork';
import { combinedReadiness, tacticalModelAssets, useHudArtwork, useLocalPreparation } from './ui/use-gameplay-artwork';
import { useFullscreen } from './ui/viewport/use-fullscreen';
import { ViewportPresentation } from './ui/viewport/viewport-presentation';
import './ui/hud/hud.css';

export { TerminalPresentation } from './ui/terminal/terminal-presentation';

const planeIds = {
  default: 'UI-09',
  cargo: 'UI-11',
  statistics: 'UI-12',
  power: 'UI-13',
  fleet: 'UI-14',
} as const;

/** Presents authenticated HUD ink over the stable host-owned spatial slot.
 * Owns/disposes only artwork leases, presentation clocks and navigation
 * listeners. It gates host flight input until ink and live glyphs are ready;
 * failure leaves the viewport and explicit browser recovery controls mounted.
 *
 * Preparation: the HUD and every local interaction of the current system are
 * prepared before the host reveals the scene (onPresentationReadyChange), and
 * the destination's set is prepared during the departure hold. While the host
 * keeps the scene hidden (revealed=false) no listener, clock or report runs. */
export function GameplayPresentation({
  definition,
  identity,
  hud,
  standing,
  progression = null,
  missions = null,
  onAcceptContract,
  onNegotiateContract,
  onTransportToSurface,
  onSubmitTextCommand,
  construction = null,
  onPurchasePlan,
  onDeletePlan,
  onStartConstruction,
  target,
  planetContact,
  selectedContact,
  communication,
  onPlayCommunicationCue,
  repair,
  playerSpatial,
  purchase,
  route,
  routePhase,
  routeError,
  routeErrorRevision,
  routeErrorKind,
  travel,
  onDismissTravel,
  equipment = null,
  onEquipmentCommand,
  vesselOffers,
  vesselPurchaseBusy,
  vesselPurchaseError,
  onPurchaseVessel,
  fleet = null,
  fleetBusy,
  fleetMessage,
  onAcquireFleetShip,
  onReleaseFleetShip,
  onIssueFleetOrder,
  onSetFleetMission,
  onLaunchStowedFleet,
  onRecallFleet,
  fleetManagement = null,
  onManageFleet,
  onSelectTarget,
  onDepartTo,
  onPurchaseCargo,
  onBeginRepair,
  onCancelRepair,
  onClearTarget,
  viewport,
  saveTools,
  onReturnToMenu,
  worldActivation,
  spatialOverview,
  presentedFrameSource,
  actorDeathSource,
  onInputAvailabilityChange,
  revealed,
  onPresentationReadyChange,
  cargoHold = null,
  commodityMarket = null,
  onCargoTrade,
  resourceSales = null,
  onSellResource,
  onPurchaseResource,
}: GameplayPresentationProps) {
  if (!playerSpatial) throw new Error('BM1 requires the selected actor projection.');
  const controller = useMemo(createHudController, []);
  const cheatController = useMemo(createCheatController, []);
  const cheatView = useSyncExternalStore(cheatController.subscribe, cheatController.getSnapshot);
  const openTextCommand = useRef<(() => boolean) | undefined>(undefined);
  const fleetSelection = useMemo(createFleetSelection, []);
  const selection = useSyncExternalStore(fleetSelection.subscribe, fleetSelection.getSnapshot);
  const fleetIntent = useRef<(command: FleetCommand) => boolean>(() => false);
  const playerVessel = definition.content.entityDefinitions.find(
    entity => entity.id === hud.playerDefinitionId && entity.category === 'ship'
  );
  const fleetCommandContext = () => ({
    fleet,
    onIssueFleetOrder,
    onSetFleetMission,
    onLaunchStowedFleet,
    onRecallFleet,
    playerSize: playerVessel?.category === 'ship' ? playerVessel.sizeClass : 0,
    selectedIds: fleetSelection.getSnapshot().slots.filter((id): id is string => id !== null),
    hint: controller.hint,
    clearSelection: fleetSelection.clear,
  });
  fleetIntent.current = command => dispatchFleetCommand(fleetCommandContext(), command, 'keyboard');
  const fleetDisplay = fleetReadModel(
    fleet,
    selection.hoveredSlot === null ? null : (selection.slots[selection.hoveredSlot] ?? null),
    target,
    definition
  );
  useEffect(() => {
    fleetSelection.prune(fleet?.deployments.map(link => link.entityId) ?? []);
  }, [fleet, fleetSelection]);
  useEffect(() => {
    if (travel?.operationId) fleetSelection.clear();
  }, [travel?.operationId, fleetSelection]);
  const transportIntent = useRef(onTransportToSurface);
  const pendingBoardingCue = useRef(false);
  const pendingSurfaceCue = useRef(false);
  transportIntent.current = () => {
    // Capture range before the synchronous command can destroy/deselect its
    // target. Only presentation reads this latch; it never approves boarding.
    pendingBoardingCue.current =
      target?.kind === 'npc-ship' &&
      inBoardingBeamRange({ x: target.relativeX, y: target.relativeY }, { x: 0, y: 0 }, playerSpatial.zoom);
    pendingSurfaceCue.current = Boolean(planetContact && canHailPlanet(planetContact, playerSpatial, definition));
    const accepted = onTransportToSurface?.() ?? false;
    if (!accepted) {
      pendingBoardingCue.current = false;
      pendingSurfaceCue.current = false;
    }
    return accepted;
  };
  const transportInput = useMemo(
    () =>
      createTransportInput(
        () => transportIntent.current?.() ?? false,
        command => fleetIntent.current(command),
        () => openTextCommand.current?.() ?? false
      ),
    []
  );
  const mapController = useMemo(createMapController, []);
  // Each host scene remount seeds its own historical observation baseline.
  const [communicationController] = useState(() => createCommunicationController(communication));
  const communicationView = useSyncExternalStore(
    communicationController.subscribe,
    communicationController.getSnapshot
  );
  const reportAttached = Boolean(communicationView.pending || communicationView.report);
  const constructionController = useMemo(createConstructionController, []);
  const fleetManagementController = useMemo(createFleetManagementController, []);
  const managementView = useSyncExternalStore(
    fleetManagementController.subscribe,
    fleetManagementController.getSnapshot
  );
  // Cosmetic names never consume the saved world random stream.
  const constructionNameSeed = useRef(Date.now() >>> 0);
  const constructionView = useSyncExternalStore(constructionController.subscribe, constructionController.getSnapshot);
  const observedConstructionNotice = useRef(hud.noticeSequence);
  const observedConstructionScan = useRef<number | null>(null);
  // Page1:25841:231–240 loadcomm owns ONE attachment. Reuse the existing
  // replacedByCommunication path that already tears down contact subpanels.
  const otherCommunicationAttached = reportAttached || cheatView.open || constructionView.draft !== null;
  const fleetManagementAttached = managementView.attachment !== null;
  const communicationAttached = otherCommunicationAttached || fleetManagementAttached;
  const closeFleetManagement = fleetManagementController.close;
  openTextCommand.current = onSubmitTextCommand
    ? () => {
        communicationController.close();
        constructionController.close();
        closeFleetManagement();
        cheatController.open();
        return true;
      }
    : undefined;
  const [mapOpen, setMapOpen] = useState(false);
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const tools = useRef<HTMLElement>(null);
  const gameFrame = useRef<HTMLElement>(null);
  const { fullscreen, fullscreenError, toggleFullscreen } = useFullscreen(gameFrame);
  const [panelsBusy, setPanelsBusy] = useState<Readonly<Record<string, boolean>>>({});
  const panelBusyChange: PanelBusyChange = useCallback((id, busy) => {
    setPanelsBusy(previous =>
      previous[id] === busy || (!busy && !(id in previous)) ? previous : { ...previous, [id]: busy }
    );
  }, []);
  const mapView = useSyncExternalStore(mapController.subscribe, mapController.getSnapshot);
  const [contactOverlay, setContactOverlay] = useState<HTMLDivElement | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [hailRequest, setHailRequest] = useState(0);
  const priorTravel = useRef(false);
  const observedSurfaceNotice = useRef(hud.noticeSequence);
  const transportCue = useMemo(() => createBrowserAudioCue(runtimeAssetUrl('assets/transport-beam.mp3')), []);
  // Host report audio is bound to a saved outcome sequence; this transient
  // loadcomm opening uses the same comp3 asset with a scene-owned cue instead.
  const localCommunicationCue = useMemo(
    () => createBrowserAudioCue(runtimeAssetUrl('assets/communication-open.wav')),
    []
  );
  const playLocalCommunicationCue = useCallback(() => localCommunicationCue.play(), [localCommunicationCue]);
  useEffect(() => () => localCommunicationCue.stop(), [localCommunicationCue]);
  // Keep type-25 rollouts from erasing a notice already written by a replacement.
  const lastManagementHint = useRef('');
  const setManagementHint = useCallback(
    (hint: string) => {
      if (hint || (lastManagementHint.current && controller.getSnapshot().hint === lastManagementHint.current))
        controller.hint(hint);
      lastManagementHint.current = hint;
    },
    [controller]
  );
  const showScan = useCallback(
    (message: string) => {
      closeFleetManagement();
      communicationController.showScan(message);
    },
    [closeFleetManagement, communicationController]
  );
  useEffect(() => () => transportCue.stop(), [transportCue]);
  // Notice sequence is authoritative. Restoration seeds the baseline, so saved
  // delivery/away-team reports do not replay when a scene mounts.
  useEffect(() => {
    if (
      !revealed ||
      !['surface-mission', 'ship-boarded'].includes(hud.noticeCode ?? '') ||
      !hud.noticeMessage ||
      observedSurfaceNotice.current === hud.noticeSequence
    )
      return;
    observedSurfaceNotice.current = hud.noticeSequence;
    showScan(hud.noticeMessage);
    if (hud.noticeCode === 'surface-mission' || pendingSurfaceCue.current || pendingBoardingCue.current)
      transportCue.play();
    pendingBoardingCue.current = false;
    pendingSurfaceCue.current = false;
  }, [revealed, hud.noticeCode, hud.noticeMessage, hud.noticeSequence, showScan, transportCue]);
  const contactOpenChange = useCallback(
    (open: boolean) => {
      setContactOpen(open);
      if (open) {
        mapController.close();
        cheatController.close();
      }
    },
    [mapController, cheatController]
  );
  const plane = hudContent.planes.find(plane => plane.id === planeIds[view.section])!;
  const displayed = useMemo(() => {
    try {
      const model = createHudReadModel(hud, definition, equipment);
      const tactical = createTacticalReadModel(target, definition);
      const texts: Readonly<Record<string, string>> = {
        ...createIdentityReadModel(identity, hud.playerDefinitionId, definition),
        playerresources: model.resources,
        cargotext: model.cargo,
        cargo1:
          cargoHold?.positions
            .slice(0, 5)
            .map(pod => (pod.tons ? `${pod.tons} tons of ${pod.label}\n` : '\n'))
            .join('') ?? '',
        cargo2:
          cargoHold?.positions
            .slice(5, 10)
            .map(pod => (pod.tons ? `${pod.tons} tons of ${pod.label}\n` : '\n'))
            .join('') ?? '',
        localprestige: localPrestigeText(standing),
        // C14/C15 own system ownership and owned population. The fleet count
        // is the C11 roster length, the source nonzero myfleet total (Symbol-6-52531:72-78).
        ...createStatusReadModel(
          definition.progression,
          progression?.captain ?? null,
          progression?.systemStanding ?? [],
          0,
          fleetStatisticsCount(fleet),
          0
        ),
        // UI-14 offset44016 is a LOCAL receiver: rollout must expose an empty
        // field rather than resurrecting the global keyboard notice beneath it.
        infotext: view.section === 'fleet' ? view.hint : view.hint || hud.noticeMessage || '',
        selectedname: fleetDisplay.selectedname,
        selecteddesc: fleetDisplay.selecteddesc,
      };
      plane.fields.forEach(field => {
        if (
          ['playername', 'playership'].includes(field.variable) &&
          hasUnsupportedSourceGlyph(texts[field.variable] ?? '')
        )
          return;
        layoutHudText(field, texts[field.variable] ?? '');
      });
      return { model, tactical, texts, error: null };
    } catch (error) {
      return {
        model: null,
        tactical: null,
        texts: {},
        error: error instanceof Error && error.message ? error.message : 'HUD content is unavailable',
      };
    }
  }, [
    hud,
    standing,
    progression,
    identity,
    target,
    definition,
    plane,
    view.hint,
    view.section,
    equipment,
    cargoHold,
    fleet,
    fleetDisplay.selectedname,
    fleetDisplay.selecteddesc,
  ]);
  const hudArtwork = useHudArtwork({ equipment, weaponDefinitionId: hud.weaponDefinitionId });
  const npcDefinitionIds = (spatialOverview ?? []).flatMap(entity =>
    entity.kind === 'npc-ship' && entity.definitionId ? [entity.definitionId] : []
  );
  const local = useLocalPreparation({
    definition,
    systemId: hud.systemId,
    playerDefinitionId: hud.playerDefinitionId,
    npcDefinitionIds,
    equipment,
    fleet,
  });
  // Prepare the destination during the existing departure hold, so arrival
  // remounts onto already decoded art. Its NPCs are unknown until arrival.
  useLocalPreparation(
    travel && travel.destinationSystemId !== hud.systemId
      ? {
          definition,
          systemId: travel.destinationSystemId,
          playerDefinitionId: hud.playerDefinitionId,
          npcDefinitionIds: [],
          equipment,
        }
      : null
  );
  const tacticalArtwork = useArtwork(tacticalModelAssets(displayed.tactical), displayed.tactical !== null);
  const ready = hudArtwork.ready;
  const retry = () => {
    hudArtwork.retry();
    local.retry();
  };
  const available = ready === 'ready' && !displayed.error;
  const inputAvailable = available && revealed && !Object.values(panelsBusy).some(Boolean);
  // The host reveals only a complete first view: HUD plus every local
  // interaction. Content errors count as failure so the host offers recovery.
  const presentationReadiness = displayed.error ? 'failed' : combinedReadiness(hudArtwork.ready, local.ready);
  useEffect(() => {
    onPresentationReadyChange(presentationReadiness === 'loading' ? 'pending' : presentationReadiness);
  }, [presentationReadiness, onPresentationReadyChange]);

  useEffect(() => {
    communicationController.observe(communication, available && revealed && !travel);
  }, [communicationController, communication, available, revealed, travel]);
  useEffect(() => {
    if (!revealed || !hud.noticeMessage || observedConstructionNotice.current === hud.noticeSequence) return;
    observedConstructionNotice.current = hud.noticeSequence;
    presentConstructionNotice(
      hud.noticeCode ?? '',
      hud.noticeMessage,
      constructionController,
      controller.hint,
      showScan
    );
  }, [revealed, hud.noticeSequence, hud.noticeCode, hud.noticeMessage, controller, constructionController, showScan]);
  useEffect(() => {
    if (!worldActivation || observedConstructionScan.current === worldActivation.sequence) return;
    observedConstructionScan.current = worldActivation.sequence;
    const site = construction?.sites.find(site => site.entityId === worldActivation.id);
    if (!site) return;
    const structure = definition.content.entityDefinitions.find(entity => entity.id === site.structureDefinitionId);
    if (!structure) return;
    constructionController.close();
    cheatController.close();
    showScan(incompleteStationReport(structure.name, site.remainingDays));
  }, [worldActivation, construction, definition, constructionController, cheatController, showScan]);
  useEffect(() => {
    fleetManagementController.reconcile(fleetManagement);
  }, [fleetManagementController, fleetManagement]);
  useEffect(() => {
    if (travel || reportAttached) closeFleetManagement();
  }, [travel, reportAttached, closeFleetManagement]);
  useEffect(() => {
    if (travel || reportAttached) constructionController.close();
  }, [travel, reportAttached, constructionController]);
  useEffect(() => {
    if (reportAttached) cheatController.close();
  }, [reportAttached, communicationView.report, cheatController]);
  useEffect(() => {
    // Pointer hail replaces the same slot. Contact consumes the activation on
    // the next render after the cheat attachment releases availability.
    if (!worldActivation) return;
    cheatController.close();
    constructionController.close();
  }, [worldActivation, cheatController, constructionController]);
  useEffect(() => {
    if (!communicationAttached) return;
    mapController.close();
    controller.dismiss();
  }, [communicationAttached, mapController, controller]);
  useEffect(() => {
    onInputAvailabilityChange(inputAvailable);
    return () => onInputAvailabilityChange(false);
  }, [inputAvailable, onInputAvailabilityChange]);

  // One authored HUD frame; HudFrameClock below schedules it at 13 Hz.
  const advanceHudFrame = useCallback(() => {
    controller.advance();
    if (inputAvailable) transportInput.advance();
  }, [controller, inputAvailable, transportInput]);
  useEffect(() => {
    if (!inputAvailable || travel) return;
    const clear = () => {
      controller.releaseKeys();
      transportInput.release();
    };
    const visibility = () => {
      if (document.visibilityState !== 'visible') clear();
    };
    const down = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      const insideManagement = event
        .composedPath()
        .some(target => (target as Element | null)?.closest?.('[data-fleet-management-type]'));
      if (eventHasUiInputOwner(event) && !insideManagement) return;
      if (fleetManagementAttached && key === 'q') {
        event.preventDefault();
        return;
      }
      // Management controls allow H to replace the attachment. Other flight
      // and HUD shortcuts still belong to the stage.
      if (insideManagement && key !== 'h') return;
      const fleetCode = fleet?.ordersAvailable ? fleetInputCode(event.code) : null;
      // T, F8 and numeric fleet keys share one frame-sampled source latch.
      const shortcutCode = key === 't' ? 84 : key === 'f8' && onSubmitTextCommand ? 119 : fleetCode;
      if (shortcutCode !== null) {
        event.preventDefault();
        transportInput.key(shortcutCode, true);
        return;
      }
      if (key === 'h') {
        event.preventDefault();
        if (fleetManagementAttached && event.repeat) return;
        cheatController.close();
        setHailRequest(sequence => sequence + 1);
        return;
      }
      if ((contactOpen || mapOpen || communicationAttached) && key === 'q') return;
      if (isTacticalDeselectKey(event)) {
        event.preventDefault();
        onClearTarget();
        return;
      }
      if (key !== 'p' && key !== 'q') return;
      event.preventDefault();
      controller.key(key, true);
    };
    const up = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'p' || key === 'q') controller.key(key, false);
      if (key === 't') transportInput.key(84, false);
      if (key === 'f8') transportInput.key(119, false);
      const code = fleetInputCode(event.code);
      if (code !== null) transportInput.key(code, false);
    };
    const blurTarget = () => {
      controller.releaseKeys();
      transportInput.releaseHeld();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('focusin', blurTarget);
    return () => {
      controller.releaseKeys();
      transportInput.releaseHeld();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('focusin', blurTarget);
    };
  }, [
    inputAvailable,
    travel,
    contactOpen,
    mapOpen,
    communicationAttached,
    fleetManagementAttached,
    controller,
    transportInput,
    onClearTarget,
    fleet?.ordersAvailable,
    onSubmitTextCommand,
    cheatController,
  ]);
  useEffect(() => {
    if (view.toolsOpen) tools.current?.focus();
  }, [view.toolsOpen]);
  const travelOperationId = travel?.operationId;
  useEffect(() => {
    const travelling = travelOperationId !== undefined;
    if (travelling) {
      controller.dismiss();
      mapController.close();
      cheatController.close();
    }
    // A failed preload/view restores the original source world and map retry
    // surface. A successful summary dismissal leaves the navigation closed.
    if (
      !travelling &&
      routeError &&
      (priorTravel.current || routeErrorKind === 'view' || routeErrorKind === 'assets')
    ) {
      closeFleetManagement();
      mapController.open();
    }
    priorTravel.current = travelling;
  }, [travelOperationId, routeError, routeErrorKind, controller, mapController, cheatController, closeFleetManagement]);

  return (
    <main ref={gameFrame} className="bm1-gameplay" aria-label="Broken Mirror game">
      <div
        className="bm1-game-stage"
        tabIndex={-1}
        data-hud-state={view.menu === 0 ? 'closed' : 'open'}
        data-hud-section={view.section}
        data-hud-parent-y={view.parentY}
        data-hud-ready={available}
      >
        {/* This stable host slot is always mounted once, including art failures. */}
        <div className="bm1-world-slot">{viewport}</div>
        {available && !travel && (
          <ViewportPresentation
            equipment={equipment}
            hud={hud}
            definition={definition}
            spatialOverview={spatialOverview ?? []}
            presentedFrameSource={presentedFrameSource}
          />
        )}
        <div ref={setContactOverlay} className="bm1-contact-slot" />
        <TacticalPresentation
          model={displayed.tactical}
          available={available && !travel && tacticalArtwork.ready === 'ready'}
          framesPerSecond={definition.framesPerSecond}
        />
        {/* The world keeps running under the player's warp-out ('loading'), so
            deaths there still explode; only the paused arrival hides them. */}
        <ActorExplosion
          source={actorDeathSource}
          presentedFrameSource={presentedFrameSource}
          hud={hud}
          definition={definition}
          available={available && (!travel || routePhase === 'loading')}
        />
        <HudFrameClock
          enabled={available && revealed && !travel}
          framesPerSecond={definition.framesPerSecond}
          advance={advanceHudFrame}
          controller={controller}
        >
          {drawnParentY =>
            available &&
            !travel &&
            displayed.model && (
              <HudArtwork
                plane={plane}
                drawnParentY={drawnParentY}
                model={displayed.model}
                texts={displayed.texts}
                hud={hud}
                controller={controller}
                fleetAvailable={fleet?.ordersAvailable ?? false}
                fleetHealthCover={fleetDisplay.healthCoverPercent}
                technologyWeaponIds={equipment?.technologyWeaponIds ?? []}
                fleetSlot={
                  view.section === 'fleet' && fleet?.ordersAvailable ? (
                    <FleetArtwork
                      fleet={fleet}
                      slots={selection.slots}
                      selectedDefinitionId={fleetDisplay.selectedDefinitionId}
                      onHover={fleetSelection.hover}
                      onRollOut={() => controller.hint('')}
                      onSelect={slot => {
                        if (slot > 1) return;
                        onSelectTarget?.(fleetSelection.select(slot));
                      }}
                    />
                  ) : null
                }
                cargoHints={Array.from({ length: 10 }, (_, slot) => {
                  const pod = cargoHold?.positions.find(pod => pod.slot === slot);
                  if (!pod?.tons) return '';
                  const contract = missions?.contracts.find(pod => pod.slot === slot)?.contract;
                  if (!contract) return 'This cargo is personal assets that you currently own.';
                  const name = definition.systems.find(s => s.id === contract.destinationSystemId)!.name;
                  return `This cargo is destined for the planet ${name}.`;
                })}
                equipmentSlot={
                  construction && visibleHudInventory(view) === 'plans' ? (
                    <ConstructionHud
                      view={construction}
                      onHint={controller.hint}
                      onDelete={index => {
                        const plan = construction.plans[index];
                        return Boolean(plan && onDeletePlan?.(plan.deleteIntent));
                      }}
                      onOpen={index => {
                        const plan = construction.plans[index];
                        if (!plan) return;
                        constructionNameSeed.current = (constructionNameSeed.current + 1) >>> 0;
                        communicationController.close();
                        cheatController.close();
                        closeFleetManagement();
                        constructionController.open({
                          planIndex: index,
                          structureDefinitionId: plan.structureDefinitionId,
                          revision: construction.revision,
                          sessionRevision: construction.sessionRevision,
                          name: proposeStationName(constructionNameSeed.current),
                          // Symbol-3-108813.as:5-13: only the hidden-destination type
                          // initializes loc; other types start without one.
                          destinationSystemId: isConstructionDestinationHidden(plan.structureDefinitionId)
                            ? initialConstructionDestination
                            : null,
                        });
                      }}
                    />
                  ) : equipment && onEquipmentCommand && visibleHudInventory(view) === 'equipment' ? (
                    <EquipmentHud
                      view={equipment}
                      channel={view.firingChannel}
                      onCommand={intent => {
                        onEquipmentCommand(intent);
                        controller.finishEquipmentLoad();
                      }}
                    />
                  ) : null
                }
                constructionAvailable={construction !== null}
                onActivate={action => {
                  if (action.startsWith('fleet-') && fleet?.ordersAvailable) {
                    dispatchFleetControl(
                      {
                        ...fleetCommandContext(),
                        definition,
                        overview: spatialOverview ?? [],
                        zoom: playerSpatial.zoom,
                        replaceSelection: fleetSelection.replace,
                        showReport: showScan,
                      },
                      action
                    );
                    return;
                  }
                  if (action === 'transport') {
                    transportInput.activate();
                    return;
                  }
                  if (action === 'map') {
                    communicationController.close();
                    closeFleetManagement();
                    controller.dismiss();
                    mapController.open();
                    return;
                  }
                  controller.activate(action);
                }}
              />
            )
          }
        </HudFrameClock>
        {!available && (
          <div className="bm1-hud-status" role={ready === 'failed' || displayed.error ? 'alert' : 'status'}>
            {displayed.error
              ? `Player panel unavailable: ${displayed.error}`
              : ready === 'failed'
                ? 'Player panel artwork could not be loaded.'
                : 'Loading player panel…'}
            {ready === 'failed' && <button onClick={retry}>Retry panel artwork</button>}
          </div>
        )}
      </div>
      {hud.noticeMessage && (
        <p role="alert" className="bm1-hud-accessible-notice">
          {hud.noticeMessage}
        </p>
      )}
      <nav className="bm1-hud-browser-actions" aria-label="Browser game controls">
        <button onClick={() => controller.showTools()} aria-expanded={view.toolsOpen} aria-label="Game tools and saves">
          Saves and menu
        </button>
        <button onClick={toggleFullscreen}>{fullscreen ? 'Exit full screen' : 'Full screen'}</button>
      </nav>
      {fullscreenError && <p role="alert">{fullscreenError}</p>}
      <DeferredPanel
        id="contact"
        label="Contact panel"
        active={
          (Boolean(worldActivation) || hailRequest > 0) && !mapView.open && !otherCommunicationAttached && !travel
        }
        loader={contactPanel}
        onBusyChange={panelBusyChange}
        panelProps={{
          definition,
          missions,
          fleet,
          fleetBusy,
          fleetMessage,
          onAcquireFleetShip,
          onReleaseFleetShip,
          onHailOwnedShip: entityId => {
            closeFleetManagement();
            fleetSelection.add(entityId);
            controller.activate('fleet');
          },
          onAcceptContract,
          onNegotiateContract,
          planetContact,
          standing,
          hailRequest,
          onHailRefusal: message => {
            controller.hint('No Response...');
            showScan(message);
          },
          onHailStation: station => {
            if (!fleetManagement || !fleetManagementController.open(station.id, fleetManagement)) return false;
            playLocalCommunicationCue();
            return true;
          },
          onOpenHailedContact: closeFleetManagement,
          selectedContact,
          playerSpatial,
          worldActivation: worldActivation ?? null,
          // Type 25 persists through selection changes, but contact still
          // consumes fresh pointer/H hails so they can replace the attachment.
          available: available && !travel && !otherCommunicationAttached,
          overlay: contactOverlay,
          onOpenChange: contactOpenChange,
          replacedByMap: mapView.open,
          replacedByCommunication: communicationAttached,
          repairs: { repair, onBeginRepair },
          commerce: {
            purchase,
            onPurchaseCargo,
            commodityMarket,
            onCargoTrade,
            onTradeHint: controller.hint,
            resourceSales,
            onSellResource,
            onPurchaseResource,
          },
          equipmentControls: { equipment, onEquipmentCommand },
          constructionControls: { construction, onPurchasePlan },
          shipyard: { vesselOffers, vesselPurchaseBusy, vesselPurchaseError, onPurchaseVessel },
          onPanelBusyChange: panelBusyChange,
        }}
      />
      <DeferredPanel
        id="repair"
        label="Repair panel"
        active={repair.repairing}
        loader={repairPanel}
        fallbackActions={<button onClick={onCancelRepair}>Cancel spatial repair</button>}
        onBusyChange={panelBusyChange}
        panelProps={{
          repair,
          playerSpatial,
          onCancelRepair,
          available: available && !travel,
          overlay: contactOverlay,
          framesPerSecond: definition.framesPerSecond,
        }}
      />
      <DeferredPanel
        id="navigation"
        label="Navigation panel"
        active={mapView.open || travel !== null}
        loader={navigationPanels}
        fallbackActions={!travel && <button onClick={() => mapController.close()}>Close navigation panel</button>}
        onBusyChange={panelBusyChange}
        panelProps={{
          playerDefinitionId: hud.playerDefinitionId,
          map: {
            fleet,
            navigationExperience: progression?.captain?.experience.navigation ?? 0,
            controller: mapController,
            route,
            phase: routePhase,
            error: routeError,
            errorRevision: routeErrorRevision,
            errorKind: routeErrorKind,
            available: available && !travel && !communicationAttached,
            replacedByCommunication: communicationAttached,
            overlay: contactOverlay,
            framesPerSecond: definition.framesPerSecond,
            onOpenChange: setMapOpen,
            onDepartTo,
          },
          travel: { travel, routePhase, onDismissTravel, available, overlay: contactOverlay },
        }}
      />
      <DeferredPanel
        id="communication"
        label="Fleet communication"
        active={reportAttached}
        loader={communicationPanel}
        fallbackActions={<button onClick={() => communicationController.close()}>Close fleet communication</button>}
        onBusyChange={panelBusyChange}
        panelProps={{
          controller: communicationController,
          available: available && !travel,
          overlay: contactOverlay,
          framesPerSecond: definition.framesPerSecond,
          onPlayCue: onPlayCommunicationCue,
        }}
      />
      {onSubmitTextCommand && (
        <DeferredPanel
          id="cheat"
          label="Cheat console"
          active={cheatView.open}
          loader={cheatPanel}
          onBusyChange={panelBusyChange}
          panelProps={{
            controller: cheatController,
            available: available && revealed && !travel,
            overlay: contactOverlay,
            framesPerSecond: definition.framesPerSecond,
            onSubmit: onSubmitTextCommand,
            onPlayCue: playLocalCommunicationCue,
          }}
        />
      )}
      {construction && (
        <DeferredPanel
          id="construction"
          label="Station builder"
          active={constructionView.draft !== null}
          loader={constructionPanel}
          onBusyChange={panelBusyChange}
          fallbackActions={<button onClick={constructionController.close}>Cancel Build</button>}
          panelProps={{
            controller: constructionController,
            plans: construction.plans,
            destinationNames: constructionDestinationNames,
            available: available && revealed && !travel,
            overlay: contactOverlay,
            framesPerSecond: definition.framesPerSecond,
            onBegin: onStartConstruction,
          }}
        />
      )}
      <DeferredPanel
        id="fleet-management"
        label="Fleet management"
        active={fleetManagementAttached && !otherCommunicationAttached && !travel}
        loader={fleetManagementPanel}
        onBusyChange={panelBusyChange}
        fallbackActions={<button onClick={closeFleetManagement}>Exit Menu</button>}
        panelProps={{
          controller: fleetManagementController,
          view: fleetManagement,
          definition,
          available: available && revealed && !travel && !otherCommunicationAttached,
          overlay: contactOverlay,
          framesPerSecond: definition.framesPerSecond,
          onManageFleet,
          onHint: setManagementHint,
        }}
      />
      <section
        ref={tools}
        tabIndex={-1}
        data-game-input="blocked"
        className="bm1-slice-tools"
        aria-label="Game tools and saves"
        hidden={!view.toolsOpen}
      >
        <button onClick={() => controller.hideTools()}>Close game tools</button>
        <button onClick={onReturnToMenu}>Return to menu</button>
        {saveTools}
      </section>
    </main>
  );
}

/** A neutral host option: host preflight/cancellation owns this hold, never a
 * component timer or arrival acknowledgement. Source cadence is13Hz. */
GameplayPresentation.travelPresentation = Object.freeze({
  departureDurationMs: TRAVEL_DEPARTURE_DURATION_MS,
  hidePlayerDuringDeparture: true,
});
