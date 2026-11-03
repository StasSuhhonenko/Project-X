/** React-owned terminal-session choices; simulation state decides when it appears. */
import type { TerminalPresentationProps } from './terminal-presentation';

/** Generic terminal fallback using the same validated exits as authored modules. */
export function PlayerDeathScreen({ definition, onRestart, onReturnToMenu, saveTools }: TerminalPresentationProps) {
  return (
    <main className="player-death-screen" aria-labelledby="player-death-title">
      <p className="eyebrow">{definition.title}</p>
      <h1 id="player-death-title">Vessel destroyed</h1>
      <p className="subtitle">Your ship has been lost.</p>
      <div className="player-death-actions">
        <button type="button" onClick={onRestart}>Restart</button>
        <button type="button" onClick={onReturnToMenu}>Return to menu</button>
      </div>
      {saveTools}
    </main>
  );
}
