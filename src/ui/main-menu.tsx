/** React main menu; game initialization stays in the store action. */
import type { GameModuleDefinition } from '../content/schemas/game-module';

/** Content-driven controls dispatch a named intent supplied by the host. */
export function MainMenu({ definition, onStart }: {
  readonly definition: GameModuleDefinition;
  readonly onStart: (startId: string) => void;
}) {
  return (
    <main className="main-menu">
      <h1>{definition.title}</h1>
      <p className="subtitle">{definition.subtitle}</p>
      {definition.starts.map(start => <button key={start.id} type="button" onClick={() => onStart(start.id)}>{start.label}</button>)}
      <p className="build-note">{definition.notice}</p>
    </main>
  );
}
