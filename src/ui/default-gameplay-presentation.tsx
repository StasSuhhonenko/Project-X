/** Generic gameplay frame for modules without an authored presentation. */
import { useEffect } from 'react';
import { GameHudReadout } from './game-hud-readout';
import type { GameplayPresentationProps } from './gameplay-presentation';
import { TargetReadout } from './target-panel';
import { ContactReadout } from './contact-readout';

/** Preserve the existing spatial view, HUD, supported panels and save placement. */
export function GameplayPresentation({ definition, hud, target, planetContact, selectedContact, onClearTarget, viewport, sliceTools, saveTools,
  onReturnToMenu, onInputAvailabilityChange }: GameplayPresentationProps) {
  useEffect(() => {
    onInputAvailabilityChange(true);
    return () => onInputAvailabilityChange(false);
  }, [onInputAvailabilityChange]);
  return <main className="game-scene">
    {viewport}
    <GameHudReadout definition={definition} view={hud} onReturnToMenu={onReturnToMenu} />
    <TargetReadout definition={definition} target={target} onClearTarget={onClearTarget} />
    <ContactReadout definition={definition} planetContact={planetContact} selectedContact={selectedContact} />
    {sliceTools}
    {saveTools}
  </main>;
}
