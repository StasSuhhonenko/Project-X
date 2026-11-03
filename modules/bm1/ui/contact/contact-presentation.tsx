/** Original click-to-contact ink over the stable host viewport. Contact panels
 * consume implemented world facts; unported diplomacy/commerce stays absent.
 * Route attachment, scale and focus are transient and never enter saves. */
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { GameModuleDefinition } from '../../../../src/content/schemas/game-module';
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

/** Only authored regions block world picking. Layer-1 blocker is painted first
 * and exact actionable regions last, so Exit remains reachable above it. */
export function ContactPresentation({ definition, planetContact, selectedContact, playerSpatial, available, overlay, onOpenChange, repair, onBeginRepair, purchase, onPurchaseCargo, worldActivation, replacedByMap = false, replacedByCommunication = false }: {
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
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const exit = useRef<SVGGElement>(null);
  const previousOpen = useRef(false);
  const contact = view.route === 'planet' ? planetContact : view.route === 'selected' ? selectedContact : null;
  const matches = contact && contact.id === view.id;
  const offer = contact?.kind === 'npc-ship' && purchase?.merchantEntityId === contact.id ? purchase : null;
  const displayed = useMemo(() => {
    try { return { model: matches ? createContactReadModel(contact, definition, offer, view.purchaseHint) : null, error: null }; }
    catch (error) { return { model: null, error: error instanceof Error ? error.message : 'Contact unavailable' }; }
  }, [matches, contact, definition, offer, view.purchaseHint]);
  const open = Boolean(view.route && matches);
  useEffect(() => controller.reconcile(planetContact?.id ?? null, selectedContact?.id ?? null), [controller, planetContact?.id, selectedContact?.id]);
  // Source addselectship()/deselectship() remove the communication attachment,
  // including a planet contact that was open before a selection changed.
  useEffect(() => controller.close(), [controller, selectedContact?.id]);
  // A repeated click has its own sequence. Open after selection reconciliation,
  // so selecting a station cannot immediately tear down its new contact panel.
  useEffect(() => {
    if (!available || !worldActivation) return;
    if (worldActivation.kind === 'planet' && worldActivation.id === planetContact?.id && canHailPlanet(planetContact, playerSpatial, definition)) controller.open('planet', worldActivation.id);
    if (worldActivation.kind === 'station' && worldActivation.id === selectedContact?.id) controller.open('selected', worldActivation.id);
    // Source release selects an unselected ship; a later click on that selected
    // ship hails it. This is identity-based, with no double-click time window.
    if (worldActivation.kind === 'npc-ship' && worldActivation.selectedBefore && worldActivation.id === selectedContact?.id) controller.open('selected', worldActivation.id);
  }, [controller, worldActivation?.sequence]);
  // Source loadcomm replaces the existing communication attachment. Discard
  // contact navigation so closing the map cannot resurrect its previous clip.
  useEffect(() => { if (replacedByMap) controller.close(); }, [controller, replacedByMap]);
  useEffect(() => { if (replacedByCommunication) controller.close(); }, [controller, replacedByCommunication]);
  useEffect(() => { onOpenChange(open); return () => onOpenChange(false); }, [onOpenChange, open]);
  useEffect(() => {
    if (open && available) exit.current?.querySelector<SVGGElement>('[role="button"]')?.focus();
    if (!open && previousOpen.current && !replacedByCommunication) overlay?.closest<HTMLElement>('.bm1-game-stage')?.focus();
    previousOpen.current = open;
  }, [open, available, replacedByCommunication, overlay]);
  usePresentationClock(open && available && view.scale < layout.maximumScale,
    definition.framesPerSecond, controller.advance);
  useEffect(() => {
    if (!open || !available) return;
    const down = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.key.toLowerCase() !== 'q') return;
      const ownControl = event.target instanceof Element && event.target.closest('[data-contact-kind] [data-source-control]');
      if (eventHasUiInputOwner(event) && !ownControl) return;
      event.preventDefault(); controller.close();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [available, controller, open]);
  const model = displayed.model;

  return <>
    {displayed.error && <p role="alert">Contact unavailable: {displayed.error}</p>}
    {overlay && available && model && createPortal(<ContactArtwork model={model} scale={view.scale}
      offer={offer} repair={repair} exitRef={exit} onClose={controller.close} onPurchaseHint={controller.purchaseHint}
      onBeginRepair={onBeginRepair} onPurchaseCargo={onPurchaseCargo} />, overlay)}
  </>;
}
