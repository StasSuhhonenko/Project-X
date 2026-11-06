/** Independently authored terminal scene, exercising final facts and guarded exits. */
import type { TerminalPresentationProps } from '../../src/ui/terminal-presentation';

/** No active viewport, input subscription or simulation clock survives here. */
export function TerminalPresentation({ definition, terminal, onReturnToMenu, onRestart, saveTools }: TerminalPresentationProps) {
  const vessel = definition.content.entityDefinitions.find(candidate => candidate.id === terminal.playerDefinitionId);
  const system = definition.systems.find(candidate => candidate.id === terminal.systemId);
  return <main className="player-death-screen" aria-labelledby="survey-ended-title">
    <p className="eyebrow">{definition.title}</p>
    <h1 id="survey-ended-title">Survey ended</h1>
    <p>{vessel?.name ?? 'Survey vessel'} was lost in {system?.name ?? 'the last survey sector'}.</p>
    <p>The final bearing was {Math.round(terminal.headingDegrees)} degrees. World time has stopped.</p>
    <div className="player-death-actions">
      <button type="button" onClick={onRestart}>Start another survey</button>
      <button type="button" onClick={onReturnToMenu}>Return to menu</button>
    </div>
    {saveTools}
  </main>;
}
