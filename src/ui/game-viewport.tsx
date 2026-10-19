/** React lifecycle boundary for the imperative PixiJS view. */
import { useEffect, useRef } from 'react';
import { createPixiGameView, type GameViewStateSource, type PixiGameView } from '../rendering/pixi-game-view';
import type { GameModuleDefinition } from '../content/schemas/game-module';

export function GameViewport({ store, definition, onViewReady, onViewError }: {
  readonly store: GameViewStateSource;
  readonly definition: GameModuleDefinition;
  readonly onViewReady: (view: PixiGameView | null) => void;
  readonly onViewError?: (error: Error) => void;
}) {
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
        onViewReady(view);
      })
      .catch(error => {
        if (disposed) return;
        const failure = error instanceof Error ? error : new Error(String(error));
        onViewError?.(failure);
        const message = failure.message;
        host.textContent = `The spatial view could not start: ${message}`;
        host.setAttribute('role', 'alert');
      });
    return () => {
      disposed = true;
      onViewReady(null);
      destroy?.();
    };
  }, [store, definition, onViewReady, onViewError]);
  return <div className="game-viewport" style={{ aspectRatio: `${definition.viewport.width} / ${definition.viewport.height}` }} ref={hostRef} aria-label={`${definition.title} game view`} />;
}
