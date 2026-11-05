import { EquipmentPanel } from './equipment-panel';
/** Independently authored gameplay composition using focused reusable controls. */
import { useEffect, useRef, useState } from 'react';
export { TerminalPresentation } from './terminal-presentation';
import { GameHudReadout } from '../../src/ui/game-hud-readout';
import type { GameplayPresentationProps } from '../../src/ui/gameplay-presentation';
import { TargetReadout } from '../../src/ui/target-panel';
import { ContactReadout } from '../../src/ui/contact-readout';
import { RepairReadout } from '../../src/ui/repair-panel';
import { PurchaseReadout } from '../../src/ui/trade-panel';
import { MapReadout } from '../../src/ui/map-panel';
import { TravelReadout } from '../../src/ui/travel-readout';

/** Exercise the same frame/read-model/input capability without recovered media. */
export function GameplayPresentation({ definition, identity, hud, standing, target, planetContact, selectedContact, repair, purchase, onPurchaseCargo, route, routePhase, routeError, onSelectDestination, onDepart, onBeginRepair, onCancelRepair, onClearTarget, viewport, sliceTools, saveTools,
  onReturnToMenu, onInputAvailabilityChange, travel, onDismissTravel, communication,
  equipment, onEquipmentCommand, vesselOffers, vesselPurchaseBusy, vesselPurchaseError, onPurchaseVessel }: GameplayPresentationProps) {
  // Mount establishes the session's observation baseline. Historical saved
  // outcomes never reopen; every newer sequence can open an identical report.
  const seen = useRef(communication?.sequence ?? 0);
  const [report, setReport] = useState<typeof communication>(null);
  useEffect(() => {
    if (!communication || communication.sequence <= seen.current) return;
    seen.current = communication.sequence;
    setReport(communication);
  }, [communication]);
  useEffect(() => {
    onInputAvailabilityChange(true);
    return () => onInputAvailabilityChange(false);
  }, [onInputAvailabilityChange]);
  return <main className="game-scene">
    {viewport}
    <GameHudReadout definition={definition} view={hud} identity={identity} onReturnToMenu={onReturnToMenu} />
    {standing && <p aria-label="Current system standing">Survey standing: {standing.value}</p>}
    {planetContact && <p aria-label="Current system strength">District capacity: {planetContact.strength ?? 'unavailable'}</p>}
    {report && <section role="dialog" aria-label="Survey archive report">
      <p>{report.message}</p><button type="button" onClick={() => setReport(null)}>Close survey report</button>
    </section>}
    <TargetReadout definition={definition} target={target} onClearTarget={onClearTarget} />
    <ContactReadout definition={definition} planetContact={planetContact} selectedContact={selectedContact} />
    <RepairReadout definition={definition} playerDefinitionId={hud.playerDefinitionId} repair={repair}
      onBeginRepair={onBeginRepair} onCancelRepair={onCancelRepair} />
    <PurchaseReadout definition={definition} purchase={purchase} onPurchaseCargo={onPurchaseCargo} />
    <EquipmentPanel equipment={equipment} definition={definition} onEquipmentCommand={onEquipmentCommand} />
    <section aria-label="Vessel refit">
      {vesselOffers.map(offer=><button key={offer.intent.vesselDefinitionId} disabled={vesselPurchaseBusy || !offer.approval}
        onClick={()=>onPurchaseVessel(offer.intent)}>Refit to {definition.content.entityDefinitions.find(ship=>ship.id===offer.intent.vesselDefinitionId)?.name} (25 credits)</button>)}
      {vesselPurchaseError && <p role="alert">{vesselPurchaseError}</p>}
    </section>
    <MapReadout route={route} routePhase={routePhase} routeError={routeError}
      onSelectDestination={onSelectDestination} onDepart={onDepart} />
    <TravelReadout definition={definition} travel={travel} routePhase={routePhase} onDismissTravel={onDismissTravel} />
    {sliceTools}
    {saveTools}
  </main>;
}

/** Authored demo pacing, independent of other modules' departure artwork. */
GameplayPresentation.travelPresentation = { departureDurationMs: 120 };
