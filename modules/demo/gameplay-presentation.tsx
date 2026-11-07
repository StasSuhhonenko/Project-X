/** Independently authored gameplay composition using focused reusable controls. */
import { useEffect, useRef, useState } from 'react';
import { ContactReadout } from '@engine/ui/contact-readout';
import { GameHudReadout } from '@engine/ui/game-hud-readout';
import type { GameplayPresentationProps } from '@engine/ui/gameplay-presentation';
import { MapReadout } from '@engine/ui/map-panel';
import { RepairReadout } from '@engine/ui/repair-panel';
import { TargetReadout } from '@engine/ui/target-panel';
import { PurchaseReadout } from '@engine/ui/trade-panel';
import { TravelReadout } from '@engine/ui/travel-readout';
import { EquipmentPanel } from './equipment-panel';

export { TerminalPresentation } from './terminal-presentation';

/** Exercise the same frame/read-model/input capability without recovered media. */
export function GameplayPresentation({
  definition,
  identity,
  hud,
  standing,
  target,
  planetContact,
  selectedContact,
  repair,
  purchase,
  onPurchaseCargo,
  route,
  routePhase,
  routeError,
  onSelectDestination,
  onDepart,
  onBeginRepair,
  onCancelRepair,
  onClearTarget,
  viewport,
  sliceTools,
  saveTools,
  onReturnToMenu,
  onInputAvailabilityChange,
  onPresentationReadyChange,
  travel,
  onDismissTravel,
  communication,
  equipment,
  onEquipmentCommand,
  vesselOffers,
  vesselPurchaseBusy,
  vesselPurchaseError,
  onPurchaseVessel,
  cargoHold,
  commodityMarket,
  onCargoTrade,
  resourceSales,
  onSellResource,
}: GameplayPresentationProps) {
  // Mount establishes the session's observation baseline. Historical saved
  // outcomes never reopen; every newer sequence can open an identical report.
  const seen = useRef(communication?.sequence ?? 0);
  const [report, setReport] = useState<typeof communication>(null);
  const [tradeResult, setTradeResult] = useState('');
  useEffect(() => {
    if (!communication || communication.sequence <= seen.current) return;
    seen.current = communication.sequence;
    setReport(communication);
  }, [communication]);
  useEffect(() => {
    onInputAvailabilityChange(true);
    return () => onInputAvailabilityChange(false);
  }, [onInputAvailabilityChange]);
  // DOM-only readouts need no preparation: the first committed render is complete.
  useEffect(() => {
    onPresentationReadyChange('ready');
  }, [onPresentationReadyChange]);
  return (
    <main className="game-scene">
      {viewport}
      <GameHudReadout definition={definition} view={hud} identity={identity} onReturnToMenu={onReturnToMenu} />
      {standing && <p aria-label="Current system standing">Survey standing: {standing.value}</p>}
      {planetContact && (
        <p aria-label="Current system strength">District capacity: {planetContact.strength ?? 'unavailable'}</p>
      )}
      {report && (
        <section role="dialog" aria-label="Survey archive report">
          <p>{report.message}</p>
          <button type="button" onClick={() => setReport(null)}>
            Close survey report
          </button>
        </section>
      )}
      <TargetReadout definition={definition} target={target} onClearTarget={onClearTarget} />
      <ContactReadout definition={definition} planetContact={planetContact} selectedContact={selectedContact} />
      <RepairReadout
        definition={definition}
        playerDefinitionId={hud.playerDefinitionId}
        repair={repair}
        onBeginRepair={onBeginRepair}
        onCancelRepair={onCancelRepair}
      />
      <PurchaseReadout definition={definition} purchase={purchase} onPurchaseCargo={onPurchaseCargo} />
      {cargoHold && (
        <section aria-label="Cargo hold">
          <p>
            {cargoHold.usedTons} / {cargoHold.capacityTons} tons
          </p>
          <ol>
            {cargoHold.positions.map(position => (
              <li key={position.slot}>
                {position.label ? `${position.label}: ${position.tons} tons` : 'Empty position'}
              </li>
            ))}
          </ol>
        </section>
      )}
      {commodityMarket && onCargoTrade && (
        <section aria-label="Commodity exchange">
          {commodityMarket.rows.map(row => (
            <div key={row.key}>
              <p>
                {row.label}: {row.pricePerTon} credits per ton
              </p>
              {/* The existing purchase readout owns the ship's finite supply. */}
              {commodityMarket.kind === 'station' && row.buy && (
                <button
                  disabled={row.buy.refusal !== null}
                  onClick={() => setTradeResult(onCargoTrade(row.buy!.intent) ?? 'Trade complete')}
                >
                  Buy {row.label}
                </button>
              )}
              {row.sell && (
                <button
                  disabled={row.sell.refusal !== null}
                  onClick={() => setTradeResult(onCargoTrade(row.sell!.intent) ?? 'Trade complete')}
                >
                  Sell {row.label}
                </button>
              )}
            </div>
          ))}
          <p role="status">{tradeResult}</p>
        </section>
      )}
      {resourceSales && onSellResource && (
        <section aria-label="Resource exchange">
          {resourceSales
            .filter(resource => resource.one || resource.all)
            .map(resource => (
              <div key={resource.resourceId}>
                <p>
                  {resource.label}: {resource.balance}
                </p>
                {resource.one && (
                  <button onClick={() => onSellResource({ resourceId: resource.resourceId, all: false })}>
                    Exchange one {resource.label}
                  </button>
                )}
                {resource.all && (
                  <button onClick={() => onSellResource({ resourceId: resource.resourceId, all: true })}>
                    Exchange all {resource.label}
                  </button>
                )}
              </div>
            ))}
        </section>
      )}
      <EquipmentPanel equipment={equipment} definition={definition} onEquipmentCommand={onEquipmentCommand} />
      <section aria-label="Vessel refit">
        {vesselOffers.map(offer => (
          <button
            key={offer.intent.vesselDefinitionId}
            disabled={vesselPurchaseBusy || !offer.approval}
            onClick={() => onPurchaseVessel(offer.intent)}
          >
            Refit to{' '}
            {definition.content.entityDefinitions.find(ship => ship.id === offer.intent.vesselDefinitionId)?.name} (25
            credits)
          </button>
        ))}
        {vesselPurchaseError && <p role="alert">{vesselPurchaseError}</p>}
      </section>
      <MapReadout
        route={route}
        routePhase={routePhase}
        routeError={routeError}
        onSelectDestination={onSelectDestination}
        onDepart={onDepart}
      />
      <TravelReadout
        definition={definition}
        travel={travel}
        routePhase={routePhase}
        onDismissTravel={onDismissTravel}
      />
      {sliceTools}
      {saveTools}
    </main>
  );
}

/** Authored demo pacing, independent of other modules' departure artwork. */
GameplayPresentation.travelPresentation = { departureDurationMs: 120 };
