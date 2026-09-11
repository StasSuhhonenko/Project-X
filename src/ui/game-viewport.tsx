/** React lifecycle boundary for the imperative PixiJS view. */
import { useEffect, useRef } from 'react';
import { createPixiGameView, type GameViewStateSource } from '../rendering/pixi-game-view';
import type { GameModuleDefinition } from '../content/schemas/game-module';

export function GameViewport({ store, definition }: { readonly store: GameViewStateSource; readonly definition: GameModuleDefinition }) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let destroy: (() => void) | undefined;
    void createPixiGameView(host, store, definition)
      .then(view => {
        if (disposed) {
          view.destroy();
          return;
        }
        destroy = view.destroy;
      })
      .catch(error => {
        if (disposed) return;
        const message = error instanceof Error ? error.message : String(error);
        host.textContent = `The spatial view could not start: ${message}`;
        host.setAttribute('role', 'alert');
      });
    return () => {
      disposed = true;
      destroy?.();
    };
  }, [store, definition]);
  return <div className="game-viewport" style={{ aspectRatio: `${definition.viewport.width} / ${definition.viewport.height}` }} ref={hostRef} aria-label={`${definition.title} game view`} />;
}
