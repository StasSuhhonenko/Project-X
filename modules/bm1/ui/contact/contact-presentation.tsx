/** Original click-to-contact ink over the stable host viewport. Contact panels
 * consume implemented world facts; unported diplomacy stays absent.
 * Route attachment, scale and focus are transient and never enter saves. */
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { eventHasUiInputOwner } from '@engine/platform/keyboard/ui-input-ownership';
import type { PixiSceneDefinition as GameModuleDefinition } from '@engine/rendering/pixi/configuration';
import type { ResourceSaleIntent } from '@engine/simulation/contracts/cargo-trade';
import type { ResourcePurchaseIntent, ResourcePurchaseResult } from '@engine/simulation/contracts/resource-purchase';
import type { EquipmentIntent } from '@engine/simulation/features/equipment';
import type { VesselPurchaseIntent } from '@engine/simulation/features/vessel-purchase';
import type { CargoTradeIntent, CargoTradeRefusal } from '@engine/simulation/model/cargo-transactions';
import type { ContractOfferRef } from '@engine/simulation/model/mission-state';
import type { CommodityMarketView, ResourceSalesView } from '@engine/ui/cargo-trade-view';
import type { PlanetContactView, SelectedContactView } from '@engine/ui/contact-view';
import type { EquipmentView } from '@engine/ui/equipment-view';
import type { MissionView } from '@engine/ui/mission-view';
import type { PlayerSpatialView } from '@engine/ui/player-spatial-view';
import type { PurchaseView } from '@engine/ui/purchase-view';
import type { RepairView } from '@engine/ui/repair-view';
import type { WorldActivation } from '@engine/ui/spatial-overview-view';
import type { SystemStandingView } from '@engine/ui/system-standing-view';
import type { VesselOfferView } from '@engine/ui/vessel-purchase-view';
import { worldToSourceStage } from '../../source-geometry';
import { commerceAsset, commerceIcon } from '../commerce/commerce-content';
import { DeferredPanel, type PanelBusyChange } from '../deferred-panel';
import { equipmentAsset, equipmentContent } from '../equipment/equipment-content';
import { equipmentSalePanel, merchantPanel, shipyardPanel } from '../panel-loaders';
import { shipyardAsset, shipyardContent } from '../shipyard/shipyard-content';
import { usePresentationClock } from '../use-presentation-clock';
import { ContactArtwork } from './contact-artwork';
import { contactAsset, contactContent } from './contact-content';
import { createContactController } from './contact-controller';
import { CONTACT_LAYOUT as layout } from './contact-layout';
import { createContactReadModel } from './contact-read-model';
import { requestContactHail } from './hail-access';
import { MissionPanel, missionPanelAssets } from './mission-panel';
import { requestStationShipPreview } from './station-ship-offers';

/** Merchant quotes, trade feedback and optional planet resource exchange. */
export interface ContactCommerceProps {
  readonly commodityMarket?: CommodityMarketView | null;
  readonly onCargoTrade?: ((intent: CargoTradeIntent) => CargoTradeRefusal | null) | undefined;
  readonly onTradeHint?: ((text: string) => void) | undefined;
  readonly resourceSales?: ResourceSalesView | null;
  readonly onSellResource?: ((intent: ResourceSaleIntent) => boolean) | undefined;
  readonly onPurchaseResource?: ((intent: ResourcePurchaseIntent) => ResourcePurchaseResult | null) | undefined;
  readonly purchase: PurchaseView | null;
  readonly onPurchaseCargo: (quantityTons: number) => void;
}

/** Equipment is absent when the selected module offers no equipment controls. */
export interface ContactEquipmentProps {
  readonly equipment?: EquipmentView | null | undefined;
  readonly onEquipmentCommand?: ((intent: EquipmentIntent) => void) | undefined;
}

/** Vessel offers and the renderer preflight/replacement feedback they share. */
export interface ContactShipyardProps {
  readonly vesselOffers: readonly VesselOfferView[];
  readonly vesselPurchaseBusy: boolean;
  readonly vesselPurchaseError: string | null;
  readonly onPurchaseVessel: (intent: VesselPurchaseIntent) => void;
}

/** Authoritative repair projection and its guarded start command. */
export interface ContactRepairProps {
  readonly repair: RepairView;
  readonly onBeginRepair: () => void;
}

export interface ContactPresentationProps {
  readonly missions?: MissionView | null;
  readonly onAcceptContract?: ((ref: ContractOfferRef) => boolean) | undefined;
  readonly onNegotiateContract?: ((ref: ContractOfferRef) => boolean) | undefined;
  readonly standing?: SystemStandingView | null;
  readonly hailRequest?: number;
  readonly onHailRefusal?: (message: string) => void;
  readonly onPanelBusyChange?: PanelBusyChange | undefined;
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
  readonly commerce: ContactCommerceProps;
  readonly equipmentControls?: ContactEquipmentProps;
  readonly shipyard: ContactShipyardProps;
  readonly repairs: ContactRepairProps;
}

/** Only authored regions block world picking. Layer-1 blocker is painted first
 * and exact actionable regions last, so Exit remains reachable above it. */
export function ContactPresentation({
  missions = null,
  onAcceptContract,
  onNegotiateContract,
  standing = null,
  hailRequest = 0,
  onHailRefusal,
  definition,
  planetContact,
  selectedContact,
  playerSpatial,
  available,
  overlay,
  onOpenChange,
  worldActivation,
  replacedByMap = false,
  replacedByCommunication = false,
  onPanelBusyChange,
  commerce: {
    purchase,
    onPurchaseCargo,
    commodityMarket = null,
    onCargoTrade,
    onTradeHint,
    resourceSales = null,
    onSellResource,
    onPurchaseResource,
  },
  equipmentControls: { equipment, onEquipmentCommand } = {},
  shipyard: { vesselOffers, vesselPurchaseBusy, vesselPurchaseError, onPurchaseVessel },
  repairs: { repair, onBeginRepair },
}: ContactPresentationProps) {
  const controller = useMemo(createContactController, []);
  const [saleOpen, setSaleOpen] = useState(false);
  const [merchantOpen, setMerchantOpen] = useState(false);
  const [missionOpen, setMissionOpen] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const exit = useRef<SVGGElement>(null);
  const previousOpen = useRef(false);
  const previousPurchaseBusy = useRef(false);
  const activationSequence = useRef<number | null>(null);
  const lastHailRequest = useRef(0);
  // All three source callers converge here before contact attachment.
  const hail = useCallback(
    (contact: PlanetContactView | SelectedContactView) => {
      requestContactHail(contact, standing, playerSpatial, definition, controller.open, message =>
        onHailRefusal?.(message)
      );
    },
    [controller, standing, playerSpatial, definition, onHailRefusal]
  );
  useEffect(() => {
    if (previousPurchaseBusy.current && !vesselPurchaseBusy && !vesselPurchaseError) controller.close();
    previousPurchaseBusy.current = vesselPurchaseBusy;
  }, [controller, vesselPurchaseBusy, vesselPurchaseError]);
  const contact = view.route === 'planet' ? planetContact : view.route === 'selected' ? selectedContact : null;
  const matches = contact && contact.id === view.id;
  const contract =
    missions?.offers.find(row =>
      contact?.kind === 'planet'
        ? row.ref.kind === 'planet'
        : contact?.kind === 'station' && row.ref.stationId === contact.stationId
    ) ?? null;
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
  const contactOffers = vesselOffers.filter(offer =>
    contact?.kind === 'station'
      ? offer.intent.stationEntityId === contact.id
      : offer.intent.stationEntityId === undefined
  );
  const vesselOffer =
    previewId === null ? null : (contactOffers.find(offer => offer.intent.vesselDefinitionId === previewId) ?? null);
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
      setMissionOpen(false);
    }
  }, [open]);
  useEffect(() => {
    if ((previewId === null && !saleOpen) || !planetContact || vesselPurchaseBusy) return;
    // Station type23 has no planet-bounds exit (Symbol3:113894).
    if (previewId !== null && contact?.kind === 'station') return;
    const point = worldToSourceStage(
      { x: planetContact.relativeX, y: planetContact.relativeY },
      { x: 0, y: 0 },
      playerSpatial.zoom
    );
    if (point.x < -50 || point.x > 700 || point.y < -50 || point.y > 450) controller.close();
  }, [previewId, saleOpen, planetContact, playerSpatial.zoom, vesselPurchaseBusy, controller, contact?.kind]);
  const shipOffers =
    contact?.kind === 'station'
      ? (definition.systems
          .find(system => system.id === contact.systemId)
          ?.stations.find(station => station.id === contact.stationId)
          ?.shipOffers?.map(id => contactOffers.find(offer => offer.intent.vesselDefinitionId === id) ?? null) ?? [])
      : (definition.systems
          .find(system => system.id === planetContact?.systemId)
          ?.planet.offeredEntityDefinitionIds.map(
            id => contactOffers.find(offer => offer.intent.vesselDefinitionId === id) ?? null
          ) ?? []);
  useEffect(
    () => controller.reconcile(planetContact?.id ?? null, selectedContact?.id ?? null),
    [controller, planetContact?.id, selectedContact?.id]
  );
  // Source addselectship()/deselectship() remove the communication attachment,
  // including a planet contact that was open before a selection changed.
  useEffect(() => controller.close(), [controller, selectedContact?.id]);
  useEffect(() => {
    if (!available || hailRequest === lastHailRequest.current) return;
    lastHailRequest.current = hailRequest;
    const contact = selectedContact ?? planetContact;
    if (contact) hail(contact);
  }, [available, hailRequest, selectedContact, planetContact, hail]);
  // A repeated click has its own sequence. Open after selection reconciliation,
  // so selecting a station cannot immediately tear down its new contact panel.
  useEffect(() => {
    if (!available || !worldActivation || activationSequence.current === worldActivation.sequence) return;
    activationSequence.current = worldActivation.sequence;
    if (worldActivation.kind === 'planet' && worldActivation.id === planetContact?.id) hail(planetContact);
    if (worldActivation.kind === 'station' && worldActivation.id === selectedContact?.id) hail(selectedContact);
    // Source release selects an unselected ship; a later click on that selected
    // ship hails it. This is identity-based, with no double-click time window.
    if (
      worldActivation.kind === 'npc-ship' &&
      worldActivation.selectedBefore &&
      worldActivation.id === selectedContact?.id
    )
      hail(selectedContact);
  }, [controller, worldActivation, available, planetContact, selectedContact, playerSpatial, definition, hail]);
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
    controller.advance
  );
  useEffect(() => {
    if (!open || !available) return;
    const down = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.key.toLowerCase() !== 'q')
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
          missionOpen && onAcceptContract && onNegotiateContract ? (
            <MissionPanel
              contract={contract}
              definition={definition}
              scale={view.scale}
              onClose={controller.close}
              onAccept={onAcceptContract}
              onNegotiate={onNegotiateContract}
            />
          ) : merchantOpen && market?.kind === 'station' && onCargoTrade ? (
            <DeferredPanel
              key="merchant"
              id="merchant"
              label="Commodity merchant"
              active
              loader={merchantPanel}
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
              loader={equipmentSalePanel}
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
              loader={shipyardPanel}
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
                onPurchase: intent => {
                  setAttemptId(intent.vesselDefinitionId);
                  onPurchaseVessel(intent);
                },
              }}
            />
          ) : (
            <ContactArtwork
              model={model}
              contract={contract}
              stationId={contact?.kind === 'station' ? contact.stationId : undefined}
              onAcceptContract={onAcceptContract}
              onOpenMission={onAcceptContract && onNegotiateContract ? () => setMissionOpen(true) : undefined}
              scale={view.scale}
              offer={offer}
              repair={repair}
              exitRef={exit}
              onClose={controller.close}
              onPurchaseHint={controller.purchaseHint}
              onBeginRepair={onBeginRepair}
              onPurchaseCargo={onPurchaseCargo}
              onPurchaseResource={onPurchaseResource}
              shipOffers={shipOffers}
              equipment={equipment}
              definition={definition}
              commodityMarket={market}
              onCargoTrade={onCargoTrade}
              onTradeHint={onTradeHint}
              onOpenMerchant={() => setMerchantOpen(true)}
              onEquipmentCommand={
                onEquipmentCommand
                  ? intent => {
                      onEquipmentCommand(intent);
                      controller.close();
                    }
                  : undefined
              }
              onOpenEquipmentSale={
                model.kind === 'planet' &&
                equipment &&
                definition.systems.find(s => s.id === planetContact?.systemId)!.initialPopulationBillions > 0
                  ? () => setSaleOpen(true)
                  : undefined
              }
              onPreviewShip={id => {
                const ship = definition.content.entityDefinitions.find(
                  entity => entity.id === id && entity.category === 'ship'
                );
                if (contact?.kind === 'station' && ship?.category === 'ship') {
                  requestStationShipPreview(
                    contact.systemId,
                    ship.sizeClass,
                    standing,
                    () => {
                      setPreviewId(id);
                      setAttemptId(null);
                    },
                    message => onHailRefusal?.(message)
                  );
                  return;
                }
                setPreviewId(id);
                setAttemptId(null);
              }}
            />
          ),
          overlay
        )}
    </>
  );
}

/** Facts that decide which contact artwork a system shows. */
export interface ContactSceneInput {
  readonly definition: ComponentProps<typeof ContactPresentation>['definition'];
  readonly systemId: number | null;
  /** Station portraits to include (the selected one, or every local station). */
  readonly stationDefinitionIds: readonly number[];
  /** Equipment offer icons shown by the contact listing. */
  readonly equipmentOfferIds: readonly (number | null)[];
  /** Whether a station commodity market (and its icon) can be shown. */
  readonly stationMarket: boolean;
}

/** Frames, planet and station portraits, planet listing ships and offer icons.
 * The one projection shared by the open contact and local preparation. */
export function contactSceneAssets({
  definition,
  systemId,
  stationDefinitionIds,
  equipmentOfferIds,
  stationMarket,
}: ContactSceneInput) {
  const system = definition.systems.find(system => system.id === systemId);
  const planet = contactContent.planets.find(planet => planet.systemId === system?.id);
  const stations = contactContent.stations.filter(station => stationDefinitionIds.includes(station.definitionId));
  const offers: readonly (number | null)[] = [
    ...(system?.planet.offeredEntityDefinitionIds ?? []),
    ...(system?.stations
      .filter(station => stationDefinitionIds.includes(station.structureDefinitionId))
      .flatMap(station => station.shipOffers ?? []) ?? []),
  ];
  return [
    ...missionPanelAssets(),
    ...contactContent.planes.map(plane => contactAsset(plane.asset)),
    ...(stationMarket ? [commerceAsset(commerceIcon(105).file)] : []),
    ...(planet ? [contactAsset(planet.asset)] : []),
    ...stations.map(station => contactAsset(station.asset)),
    ...shipyardContent.ships.filter(ship => offers.includes(ship.definitionId)).map(ship => shipyardAsset(ship.asset)),
    ...equipmentContent.icons
      .filter(icon => equipmentOfferIds.includes(icon.id))
      .map(icon => equipmentAsset(icon.file)),
  ];
}

/** Prepare current contacts/listing offers, never every planet or ship portrait.
 * Nested sale/preview preparation belongs to its own deferred presentation. */
export function contactPresentationAssets({
  definition,
  planetContact,
  selectedContact,
  equipmentControls: { equipment } = {},
  commerce: { commodityMarket },
}: ComponentProps<typeof ContactPresentation>) {
  return contactSceneAssets({
    definition,
    systemId: planetContact?.systemId ?? null,
    stationDefinitionIds: selectedContact?.kind === 'station' ? [selectedContact.definitionId] : [],
    equipmentOfferIds: equipment?.offers.map(offer => offer.weaponDefinitionId) ?? [],
    stationMarket: commodityMarket?.kind === 'station',
  });
}
