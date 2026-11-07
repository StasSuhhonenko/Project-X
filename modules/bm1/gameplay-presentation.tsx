/** Source-qualified persistent BM1 frame. Host viewport/commands remain owned
 * by the engine; this module owns authored ink, click routing and HUD navigation.
 * Browser save/menu facilities stay in a collapsed surface outside the stage. */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { eventHasUiInputOwner } from '@engine/platform/keyboard/ui-input-ownership';
import type { GameplayPresentationProps } from './presentation-contract';
import { createCommunicationController } from './ui/communication/communication-controller';
import { DeferredPanel, type PanelBusyChange } from './ui/deferred-panel';
import { hasUnsupportedSourceGlyph } from './ui/entry/editable-source-input';
import { EquipmentHud } from './ui/equipment/equipment-hud';
import { HudArtwork } from './ui/hud/hud-artwork';
import { hudContent } from './ui/hud/hud-content';
import { createHudController } from './ui/hud/hud-controller';
import { layoutHudText } from './ui/hud/hud-glyphs';
import { createHudReadModel } from './ui/hud/hud-read-model';
import { createIdentityReadModel } from './ui/identity-read-model';
import { createMapController } from './ui/map/map-controller';
import { communicationPanel, contactPanel, navigationPanels, repairPanel } from './ui/panel-loaders';
import { localPrestigeText } from './ui/standing-read-model';
import { ActorExplosion } from './ui/tactical/actor-explosion';
import { isTacticalDeselectKey } from './ui/tactical/tactical-controller';
import { TacticalPresentation } from './ui/tactical/tactical-presentation';
import { createTacticalReadModel } from './ui/tactical/tactical-read-model';
import { TRAVEL_DEPARTURE_DURATION_MS } from './ui/travel/departure-policy';
import { useArtwork } from './ui/use-artwork';
import { combinedReadiness, tacticalModelAssets, useHudArtwork, useLocalPreparation } from './ui/use-gameplay-artwork';
import { usePresentationClock } from './ui/use-presentation-clock';
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
  const mapController = useMemo(createMapController, []);
  // Each host scene remount seeds its own historical observation baseline.
  const [communicationController] = useState(() => createCommunicationController(communication));
  const communicationView = useSyncExternalStore(
    communicationController.subscribe,
    communicationController.getSnapshot
  );
  const communicationAttached = Boolean(communicationView.pending || communicationView.report);
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
  const priorTravel = useRef(false);
  const contactOpenChange = useCallback(
    (open: boolean) => {
      setContactOpen(open);
      if (open) mapController.close();
    },
    [mapController]
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
        infotext: view.hint || hud.noticeMessage || '',
        // Remaining progression/fleet receivers retain their separate owners.
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
  }, [hud, standing, identity, target, definition, plane, view.hint, route, routeError, equipment, cargoHold]);
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
    if (!communicationAttached) return;
    mapController.close();
    controller.dismiss();
  }, [communicationAttached, mapController, controller]);
  useEffect(() => {
    onInputAvailabilityChange(inputAvailable);
    return () => onInputAvailabilityChange(false);
  }, [inputAvailable, onInputAvailabilityChange]);

  usePresentationClock(available && revealed && !travel, definition.framesPerSecond, controller.advance);
  useEffect(() => {
    if (!inputAvailable || travel) return;
    const clear = () => {
      controller.releaseKeys();
    };
    const visibility = () => {
      if (document.visibilityState !== 'visible') clear();
    };
    const down = (event: KeyboardEvent) => {
      if (event.defaultPrevented || eventHasUiInputOwner(event) || event.ctrlKey || event.altKey || event.metaKey)
        return;
      const key = event.key.toLowerCase();
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
    };
    const blurTarget = () => controller.releaseKeys();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('focusin', blurTarget);
    return () => {
      controller.releaseKeys();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('focusin', blurTarget);
    };
  }, [inputAvailable, travel, contactOpen, mapOpen, communicationAttached, controller, onClearTarget]);
  useEffect(() => {
    if (view.toolsOpen) tools.current?.focus();
  }, [view.toolsOpen]);
  useEffect(() => {
    if (travel) {
      controller.dismiss();
      mapController.close();
    }
    // A failed preload/view restores the original source world and map retry
    // surface. A successful summary dismissal leaves the navigation closed.
    if (!travel && routeError && (priorTravel.current || routeErrorKind === 'view' || routeErrorKind === 'assets'))
      mapController.open();
    priorTravel.current = Boolean(travel);
  }, [travel?.operationId, routeError, routeErrorKind, controller, mapController]);

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
          />
        )}
        <div ref={setContactOverlay} className="bm1-contact-slot" />
        <TacticalPresentation
          model={displayed.tactical}
          available={available && !travel && tacticalArtwork.ready === 'ready'}
          framesPerSecond={definition.framesPerSecond}
        />
        <ActorExplosion
          target={target}
          hud={hud}
          spatial={playerSpatial}
          definition={definition}
          available={available && !travel}
        />
        {available && !travel && displayed.model && (
          <HudArtwork
            plane={plane}
            view={view}
            model={displayed.model}
            texts={displayed.texts}
            hud={hud}
            controller={controller}
            equipmentSlot={
              equipment && onEquipmentCommand && view.section === 'default' && view.menu === 2 ? (
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
            onActivate={action => {
              if (action === 'map') {
                communicationController.close();
                controller.dismiss();
                mapController.open();
                return;
              }
              controller.activate(action);
            }}
          />
        )}
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
        active={Boolean(worldActivation) && !mapView.open && !communicationAttached && !travel}
        loader={contactPanel}
        onBusyChange={panelBusyChange}
        panelProps={{
          definition,
          planetContact,
          selectedContact,
          playerSpatial,
          worldActivation: worldActivation ?? null,
          available: available && !travel && !communicationAttached,
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
        active={communicationAttached}
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
