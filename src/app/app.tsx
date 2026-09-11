/** React scene composition and lifecycle for the current playable slice. */
import { useEffect } from 'react';
import { createBrowserSimulationLifecycle } from '../platform/browser/browser-simulation-lifecycle';
import { createKeyboardControls } from '../platform/keyboard/keyboard-controls';
import { GameHud } from '../ui/game-hud';
import { GameViewport } from '../ui/game-viewport';
import { MainMenu } from '../ui/main-menu';
import type { GameModule } from '../content/game-module';
import type { AppStore } from './app-store';
import { useAppStore } from './app-store-context';

export function App({ store, gameModule }: { readonly store: AppStore; readonly gameModule: GameModule }) {
  const screen = useAppStore(state => state.screen);
  if (screen === 'main-menu') return <MainMenu definition={gameModule.definition} />;
  return <GameScene store={store} gameModule={gameModule} />;
}

/**
 * Owns services whose lifetime is exactly one active game scene. Unmounting the
 * scene removes keyboard listeners, stops animation scheduling, and lets the
 * viewport dispose its Pixi resources independently.
 */
function GameScene({ store, gameModule }: { readonly store: AppStore; readonly gameModule: GameModule }) {
  useEffect(() => {
    const keyboard = createKeyboardControls();
    const simulation = createBrowserSimulationLifecycle({
      framesPerSecond: gameModule.definition.framesPerSecond,
      update: () => store.getState().updatePlayer(keyboard.sample()),
    });
    simulation.start();

    return () => {
      simulation.stop();
      keyboard.dispose();
    };
  }, [store, gameModule]);

  return (
    <main className="game-scene">
      <GameViewport store={store} definition={gameModule.definition} />
      <GameHud definition={gameModule.definition} />
      <p className="control-hint">Arrow keys: steer and change speed</p>
    </main>
  );
}
