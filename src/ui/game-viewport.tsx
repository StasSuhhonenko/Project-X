/** Host lifecycle for the selected spatial adapter; rejects late completions. */
import { useEffect, useRef } from 'react';
import type { SpatialStateSource, SpatialView, SpatialActivation } from '../rendering/contracts/spatial-presentation';
import type { ScenePreparation } from '../app/scene-preparation';
import { selectPlayerEntity } from '../simulation/model/world-state';
import type { GameModuleDefinition } from '../content/schemas/game-module';

export function GameViewport({ store, definition, onViewReady, onViewError, scenes, onSelectTarget, onActivate }: {
  readonly store: SpatialStateSource;
  readonly definition: GameModuleDefinition;
  readonly onViewReady: (view: SpatialView | null) => void;
  readonly onViewError?: (error: Error) => void;
  readonly scenes: ScenePreparation;
  readonly onSelectTarget: (id: string | null) => void;
  readonly onActivate: (contact: SpatialActivation | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    const initial = store.getState();
    if (!host || !initial.world) return;
    let disposed = false;
    let lease: Awaited<ReturnType<ScenePreparation['acquire']>> | undefined;
    let view: SpatialView | undefined;
    const current = () => {
      const state = store.getState();
      if (disposed || !lease?.isCurrent() || !state.world || state.sessionRevision !== initial.sessionRevision) return false;
      const first = selectPlayerEntity(initial.world!);
      const active = selectPlayerEntity(state.world);
      return first.definitionId === active.definitionId && first.location.systemId === active.location.systemId;
    };
    const pending = scenes.acquire(initial.world);
    const generation = scenes.getGeneration();
    void pending.then(async acquired => {
      lease = acquired;
      if (!current()) { acquired.release(); return; }
      // The lease stays alive until attach has settled, even after unmount.
      view = await acquired.owner.attach({ host, source: store, intents: {
        selectTarget: id => { if (current()) onSelectTarget(id); },
        activate: contact => { if (current()) onActivate(contact); },
      } });
      if (!current()) {
        try { view.dispose(); } finally { acquired.release(); }
        return;
      }
      onViewReady(view);
    }).catch(error => {
      lease?.release();
      if (disposed || scenes.getGeneration() !== generation) return;
      const failure = error instanceof Error ? error : new Error(String(error));
      onViewError?.(failure);
      host.textContent = `The spatial view could not start: ${failure.message}`;
      host.setAttribute('role', 'alert');
    });
    return () => {
      disposed = true;
      onViewReady(null);
      if (view) {
        try { view.dispose(); } finally { lease?.release(); }
      }
    };
  }, [store, scenes, onViewReady, onViewError, onSelectTarget, onActivate]);

  return <div className="game-viewport" style={{ aspectRatio: `${definition.viewport.width} / ${definition.viewport.height}` }} ref={hostRef} aria-label={`${definition.title} game view`} />;
}
