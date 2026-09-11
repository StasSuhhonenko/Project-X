/** React HUD consuming focused Zustand selections. */
import { useAppStore } from '../app/app-store-context';
import type { GameModuleDefinition } from '../content/schemas/game-module';

export function GameHud({ definition }: { readonly definition: GameModuleDefinition }) {
  const player = useAppStore(state => state.player);
  const returnToMenu = useAppStore(state => state.returnToMenu);
  if (!player) return null;
  return (
    <aside className="game-hud">
      <div><span>Hull</span><strong>{player.hull}</strong></div>
      <div><span>Shields</span><strong>{player.shields}</strong></div>
      {definition.resources.map(resource => <div key={resource.id}><span>{resource.label}</span><strong>{player.resources[resource.id]}</strong></div>)}
      <div><span>Speed/frame</span><strong>{Math.abs(player.speedPerFrame)}</strong></div>
      <div><span>Position</span><strong>{player.position.x.toFixed(0)}, {player.position.y.toFixed(0)}</strong></div>
      <button type="button" onClick={returnToMenu}>Return to menu</button>
    </aside>
  );
}
