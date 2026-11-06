import { DeferredPanel, type PanelBusyChange } from '../deferred-panel';
import { loadEquipmentSalePanel, loadShipyardPanel, loadMerchantPanel } from '../panel-loaders';
import type { CommodityMarketView, ResourceSalesView } from '../../../../src/ui/cargo-trade-view';
import type {
  CargoTradeIntent,
  CargoTradeRefusal,
} from '../../../../src/simulation/model/cargo-transactions';
import type { ResourceSaleIntent } from '../../../../src/simulation/contracts/cargo-trade';
import { commerceAsset, commerceIcon } from '../commerce/commerce-content';
import { contactContent, contactAsset } from './contact-content';
import { shipyardContent, shipyardAsset } from '../shipyard/shipyard-content';
import { equipmentContent, equipmentAsset } from '../equipment/equipment-content';
import type { ComponentProps } from 'react';
import type { EquipmentView } from '../../../../src/ui/equipment-view';
import type { EquipmentIntent } from '../../../../src/simulation/features/equipment';
/** Original click-to-contact ink over the stable host viewport. Contact panels
 * consume implemented world facts; unported diplomacy stays absent.
 * Route attachment, scale and focus are transient and never enter saves. */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { PixiSceneDefinition as GameModuleDefinition } from '../../../../src/rendering/pixi/configuration';
import type { PlanetContactView, SelectedContactView } from '../../../../src/ui/contact-view';
import { eventHasUiInputOwner } from '../../../../src/platform/keyboard/ui-input-ownership';
import { createContactController } from './contact-controller';
import { createContactReadModel } from './contact-read-model';
import { ContactArtwork } from './contact-artwork';
import { CONTACT_LAYOUT as layout } from './contact-layout';
import type { RepairView } from '../../../../src/ui/repair-view';
import type { PurchaseView } from '../../../../src/ui/purchase-view';
import { usePresentationClock } from '../use-presentation-clock';
import type { WorldActivation } from '../../../../src/ui/spatial-overview-view';
import type { PlayerSpatialView } from '../../../../src/ui/player-spatial-view';
import { canHailPlanet } from './contact-eligibility';
import type { VesselOfferView } from '../../../../src/ui/vessel-purchase-view';
import type { VesselPurchaseIntent } from '../../../../src/simulation/features/vessel-purchase';
import { worldToSourceStage } from '../../source-geometry';

/** Only authored regions block world picking. Layer-1 blocker is painted first
 * and exact actionable regions last, so Exit remains reachable above it. */
export function ContactPresentation({
  definition,
  planetContact,
  selectedContact,
  playerSpatial,
  available,
  overlay,
  onOpenChange,
  repair,
  onBeginRepair,
  purchase,
  onPurchaseCargo,
  worldActivation,
  replacedByMap = false,
  replacedByCommunication = false,
  vesselOffers,
  vesselPurchaseBusy,
  vesselPurchaseError,
  onPurchaseVessel,
  equipment,
  onEquipmentCommand,
  onPanelBusyChange,
  commodityMarket = null,
  onCargoTrade,
  onTradeHint,
  resourceSales = null,
  onSellResource,
}: {
  readonly commodityMarket?: CommodityMarketView | null;
  readonly onCargoTrade?: ((intent: CargoTradeIntent) => CargoTradeRefusal | null) | undefined;
  readonly onTradeHint?: ((text: string) => void) | undefined;
  readonly resourceSales?: ResourceSalesView | null;
  readonly onSellResource?: ((intent: ResourceSaleIntent) => boolean) | undefined;
  readonly onPanelBusyChange?: PanelBusyChange | undefined;
  readonly equipment?: EquipmentView | null | undefined;
  readonly onEquipmentCommand?: ((intent: EquipmentIntent) => void) | undefined;
  readonly vesselOffers: readonly VesselOfferView[];
  readonly vesselPurchaseBusy: boolean;
  readonly vesselPurchaseError: string | null;
  readonly onPurchaseVessel: (intent: VesselPurchaseIntent) => void;
  readonly playerSpatial: PlayerSpatialView;
  readonly worldActivation?: WorldActivation | null;
  readonly replacedByMap?: boolean;
  readonly replacedByCommunication?: boolean;
  readonly definition: GameModuleDefinition;
  readonly planetContact: PlanetContactView | null;
  readonly selectedContact: SelectedContactView | null;
  readonly available: boolean;
  readonly overlay: HTMLElement | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly repair: RepairView;
  readonly onBeginRepair: () => void;
  readonly purchase: PurchaseView | null;
  readonly onPurchaseCargo: (quantityTons: number) => void;
}) {
  const controller = useMemo(createContactController, []);
  const [saleOpen, setSaleOpen] = useState(false);
  const [merchantOpen, setMerchantOpen] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const exit = useRef<SVGGElement>(null);
  const previousOpen = useRef(false);
  const previousPurchaseBusy = useRef(false);
  const activationSequence = useRef<number | null>(null);
  useEffect(() => {
    if (previousPurchaseBusy.current && !vesselPurchaseBusy && !vesselPurchaseError) controller.close();
    previousPurchaseBusy.current = vesselPurchaseBusy;
  }, [controller, vesselPurchaseBusy, vesselPurchaseError]);
  const contact =
    view.route === 'planet' ? planetContact : view.route === 'selected' ? selectedContact : null;
  const matches = contact && contact.id === view.id;
  const offer = contact?.kind === 'npc-ship' && purchase?.merchantEntityId === contact.id ? purchase : null;
  const market = commodityMarket?.merchantEntityId === contact?.id ? commodityMarket : null;
  const displayed = useMemo(() => {
    try {
      return {
        model: matches ? createContactReadModel(contact, definition, offer, view.purchaseHint, market) : null,
        error: null,
      };
    } catch (error) {
      return { model: null, error: error instanceof Error ? error.message : 'Contact unavailable' };
    }
  }, [matches, contact, definition, offer, view.purchaseHint, market]);
  const open = Boolean(view.route && matches);
  const vesselOffer =
    previewId === null
      ? null
      : (vesselOffers.find((offer) => offer.intent.vesselDefinitionId === previewId) ?? null);
  const hull = vesselOffers[0]?.intent.playerDefinitionId;
  useEffect(() => {
    setPreviewId(null);
    controller.close();
  }, [controller, hull]);
  useEffect(() => {
    if (!open) {
      setPreviewId(null);
      setSaleOpen(false);
      setMerchantOpen(false);
    }
  }, [open]);
  useEffect(() => {
    if ((previewId === null && !saleOpen) || !planetContact || vesselPurchaseBusy) return;
    const point = worldToSourceStage(
      { x: planetContact.relativeX, y: planetContact.relativeY },
      { x: 0, y: 0 },
      playerSpatial.zoom,
    );
    if (point.x < -50 || point.x > 700 || point.y < -50 || point.y > 450) controller.close();
  }, [previewId, saleOpen, planetContact, playerSpatial.zoom, vesselPurchaseBusy, controller]);
  const shipOffers =
    definition.systems
      .find((system) => system.id === planetContact?.systemId)
      ?.planet.offeredEntityDefinitionIds.map(
        (id) => vesselOffers.find((offer) => offer.intent.vesselDefinitionId === id) ?? null,
      ) ?? [];
  useEffect(
    () => controller.reconcile(planetContact?.id ?? null, selectedContact?.id ?? null),
    [controller, planetContact?.id, selectedContact?.id],
  );
  // Source addselectship()/deselectship() remove the communication attachment,
  // including a planet contact that was open before a selection changed.
  useEffect(() => controller.close(), [controller, selectedContact?.id]);
  // A repeated click has its own sequence. Open after selection reconciliation,
  // so selecting a station cannot immediately tear down its new contact panel.
  useEffect(() => {
    if (!available || !worldActivation || activationSequence.current === worldActivation.sequence) return;
    activationSequence.current = worldActivation.sequence;
    if (
      worldActivation.kind === 'planet' &&
      worldActivation.id === planetContact?.id &&
      canHailPlanet(planetContact, playerSpatial, definition)
    )
      controller.open('planet', worldActivation.id);
    if (worldActivation.kind === 'station' && worldActivation.id === selectedContact?.id)
      controller.open('selected', worldActivation.id);
    // Source release selects an unselected ship; a later click on that selected
    // ship hails it. This is identity-based, with no double-click time window.
    if (
      worldActivation.kind === 'npc-ship' &&
      worldActivation.selectedBefore &&
      worldActivation.id === selectedContact?.id
    )
      controller.open('selected', worldActivation.id);
  }, [controller, worldActivation?.sequence, available]);
  // Source loadcomm replaces the existing communication attachment. Discard
  // contact navigation so closing the map cannot resurrect its previous clip.
  useEffect(() => {
    if (replacedByMap) controller.close();
  }, [controller, replacedByMap]);
  useEffect(() => {
    if (replacedByCommunication) controller.close();
  }, [controller, replacedByCommunication]);
  useEffect(() => {
    onOpenChange(open);
    return () => onOpenChange(false);
  }, [onOpenChange, open]);
  useEffect(() => {
    if (open && available) exit.current?.querySelector<SVGGElement>('[role="button"]')?.focus();
    if (!open && previousOpen.current && !replacedByCommunication)
      overlay?.closest<HTMLElement>('.bm1-game-stage')?.focus();
    previousOpen.current = open;
  }, [open, available, replacedByCommunication, overlay]);
  usePresentationClock(
    open && available && view.scale < layout.maximumScale,
    definition.framesPerSecond,
    controller.advance,
  );
  useEffect(() => {
    if (!open || !available) return;
    const down = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.key.toLowerCase() !== 'q'
      )
        return;
      const ownControl =
        event.target instanceof Element && event.target.closest('[data-contact-kind] [data-source-control]');
      if (eventHasUiInputOwner(event) && !ownControl) return;
      event.preventDefault();
      controller.close();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [available, controller, open]);
  const model = displayed.model;

  return (
    <>
      {displayed.error && <p role="alert">Contact unavailable: {displayed.error}</p>}
      {overlay &&
        available &&
        model &&
        createPortal(
          merchantOpen && market?.kind === 'station' && onCargoTrade ? (
            <DeferredPanel
              key="merchant"
              id="merchant"
              label="Commodity merchant"
              active
              load={loadMerchantPanel}
              onBusyChange={onPanelBusyChange}
              fallbackActions={<button onClick={controller.close}>Close commodity merchant</button>}
              panelProps={{
                market,
                scale: view.scale,
                onTrade: onCargoTrade,
                onClose: controller.close,
                onHint: onTradeHint ?? (() => {}),
              }}
            />
          ) : saleOpen && equipment && onEquipmentCommand ? (
            <DeferredPanel
              key="sale"
              id="equipment-sale"
              label="Equipment sale"
              active
              load={loadEquipmentSalePanel}
              onBusyChange={onPanelBusyChange}
              fallbackActions={<button onClick={() => setSaleOpen(false)}>Return to planet listing</button>}
              panelProps={{
                view: equipment,
                definition,
                onCommand: onEquipmentCommand,
                onExit: () => setSaleOpen(false),
                resourceSales,
                onSellResource,
                onTradeHint,
              }}
            />
          ) : vesselOffer ? (
            <DeferredPanel
              key="shipyard"
              id="shipyard"
              label="Ship preview"
              active
              load={loadShipyardPanel}
              onBusyChange={onPanelBusyChange}
              fallbackActions={
                <button
                  onClick={() => {
                    setPreviewId(null);
                    setAttemptId(null);
                  }}
                >
                  Exit ship preview
                </button>
              }
              panelProps={{
                offer: vesselOffer,
                definition,
                busy: vesselPurchaseBusy,
                error: attemptId === previewId ? vesselPurchaseError : null,
                onExit: () => {
                  setPreviewId(null);
                  setAttemptId(null);
                },
                onPurchase: (intent) => {
                  setAttemptId(intent.vesselDefinitionId);
                  onPurchaseVessel(intent);
                },
              }}
            />
          ) : (
            <ContactArtwork
              model={model}
              scale={view.scale}
              offer={offer}
              repair={repair}
              exitRef={exit}
              onClose={controller.close}
              onPurchaseHint={controller.purchaseHint}
              onBeginRepair={onBeginRepair}
              onPurchaseCargo={onPurchaseCargo}
              shipOffers={shipOffers}
              equipment={equipment}
              definition={definition}
              commodityMarket={market}
              onCargoTrade={onCargoTrade}
              onTradeHint={onTradeHint}
              onOpenMerchant={() => setMerchantOpen(true)}
              onEquipmentCommand={
                onEquipmentCommand
                  ? (intent) => {
                      onEquipmentCommand(intent);
                      controller.close();
                    }
                  : undefined
              }
              onOpenEquipmentSale={
                model.kind === 'planet' &&
                equipment &&
                definition.systems.find((s) => s.id === planetContact?.systemId)!.initialPopulationBillions >
                  0
                  ? () => setSaleOpen(true)
                  : undefined
              }
              onPreviewShip={(id) => {
                setPreviewId(id);
                setAttemptId(null);
              }}
            />
          ),
          overlay,
        )}
    </>
  );
}

/** Prepare current contacts/listing offers, never every planet or ship portrait.
 * Nested sale/preview preparation belongs to its own deferred presentation. */
export function contactPresentationAssets({
  definition,
  planetContact,
  selectedContact,
  equipment,
  commodityMarket,
}: ComponentProps<typeof ContactPresentation>) {
  const system = definition.systems.find((system) => system.id === planetContact?.systemId);
  const planet = contactContent.planets.find((planet) => planet.systemId === system?.id);
  const station =
    selectedContact?.kind === 'station'
      ? contactContent.stations.find((station) => station.definitionId === selectedContact.definitionId)
      : null;
  const offers: readonly (number | null)[] = system?.planet.offeredEntityDefinitionIds ?? [];
  const icons = equipment?.offers.map((offer) => offer.weaponDefinitionId) ?? [];
  return [
    ...contactContent.planes.map((plane) => contactAsset(plane.asset)),
    ...(commodityMarket?.kind === 'station' ? [commerceAsset(commerceIcon(105).file)] : []),
    ...(planet ? [contactAsset(planet.asset)] : []),
    ...(station ? [contactAsset(station.asset)] : []),
    ...shipyardContent.ships
      .filter((ship) => offers.includes(ship.definitionId))
      .map((ship) => shipyardAsset(ship.asset)),
    ...equipmentContent.icons
      .filter((icon) => icons.includes(icon.id))
      .map((icon) => equipmentAsset(icon.file)),
  ];
}
