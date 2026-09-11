/** React main menu; game initialization stays in the store action. */
import { useAppStore } from '../app/app-store-context';
import type { GameModuleDefinition } from '../content/schemas/game-module';

export function MainMenu({ definition }: { readonly definition: GameModuleDefinition }) {
  const startGame = useAppStore(state => state.startGame);
  return (
    <main className="main-menu">
      <h1>{definition.title}</h1>
      <p className="subtitle">{definition.subtitle}</p>
      {definition.starts.map(start => <button key={start.id} type="button" onClick={() => startGame(start.id)}>{start.label}</button>)}
      <p className="build-note">{definition.notice}</p>
    </main>
  );
}
