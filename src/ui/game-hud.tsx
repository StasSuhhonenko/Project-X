/** Legacy shared HUD adapter; selected gameplay uses the pure readout directly. */
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../app/app-store-context';
import type { GameModuleDefinition } from '../content/schemas/game-module';
import { GameHudReadout } from './game-hud-readout';
import { selectGameHudView } from './game-hud-selector';
export { selectGameHudView } from './game-hud-selector';
export type { GameHudView } from './game-hud-view';

/** Preserve existing focused store consumers without exposing them to modules. */
export function GameHud({ definition }: { readonly definition: GameModuleDefinition }) {
  const view = useAppStore(useShallow(selectGameHudView));
  const returnToMenu = useAppStore(state => state.returnToMenu);
  if (!view) return null;
  return <GameHudReadout definition={definition} view={view} onReturnToMenu={returnToMenu} />;
}
