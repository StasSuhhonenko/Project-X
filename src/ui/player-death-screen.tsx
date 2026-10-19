/** React-owned terminal-session choices; simulation state decides when it appears. */
import type { GameModuleDefinition } from '../content/schemas/game-module';
import { useAppStore } from '../app/app-store-context';

export function PlayerDeathScreen({ definition }: { readonly definition: GameModuleDefinition }) {
  const restartGame = useAppStore(state => state.restartGame);
  const returnToMenu = useAppStore(state => state.returnToMenu);

  return (
    <main className="player-death-screen" aria-labelledby="player-death-title">
      <p className="eyebrow">{definition.title}</p>
      <h1 id="player-death-title">Vessel destroyed</h1>
      <p className="subtitle">Your ship has been lost.</p>
      <div className="player-death-actions">
        <button type="button" onClick={restartGame}>Restart</button>
        <button type="button" onClick={returnToMenu}>Return to menu</button>
      </div>
    </main>
  );
}
