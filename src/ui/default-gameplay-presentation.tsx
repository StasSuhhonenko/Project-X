/** Generic gameplay frame for modules without an authored presentation. */
import { useEffect } from 'react';
import { ContactReadout } from './contact-readout';
import { GameHudReadout } from './game-hud-readout';
import type { GameplayPresentationProps } from './gameplay-presentation';
import { MapReadout } from './map-panel';
import { RepairReadout } from './repair-panel';
import { TargetReadout } from './target-panel';
import { PurchaseReadout } from './trade-panel';
import { TravelReadout } from './travel-readout';

export { PlayerDeathScreen as TerminalPresentation } from './player-death-screen';

/** Preserve the existing spatial view, HUD, supported panels and save placement. */
export function GameplayPresentation({
  definition,
  identity,
  hud,
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
  travel,
  onDismissTravel,
}: GameplayPresentationProps) {
  useEffect(() => {
    onInputAvailabilityChange(true);
    return () => onInputAvailabilityChange(false);
  }, [onInputAvailabilityChange]);
  return (
    <main className="game-scene">
      {viewport}
      <GameHudReadout definition={definition} view={hud} identity={identity} onReturnToMenu={onReturnToMenu} />
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
