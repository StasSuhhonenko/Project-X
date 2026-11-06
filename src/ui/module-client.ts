/** Selected local module assembly. No renderer package or mutable store enters
 * this result; concrete configuration stays inside the module factory closure. */
import type { SpatialPresentation } from '../rendering/contracts/spatial-presentation';
import type { EntryPresentation } from './entry-presentation';
import type { GameplayPresentation } from './gameplay-presentation';
import type { TerminalPresentation } from './terminal-presentation';
import { TravelPresentationOptionsSchema } from './travel-presentation-view';

export interface GameplayClient {
  readonly GameplayPresentation: GameplayPresentation;
  readonly TerminalPresentation?: TerminalPresentation | undefined;
  readonly spatial: SpatialPresentation;
}

/** Entry code is usable without importing a renderer or validating spatial data.
 * The factory retains one prepared gameplay client until page disposal. */
export interface ModuleClient {
  readonly EntryPresentation: EntryPresentation;
  readonly loadGameplay: () => Promise<GameplayClient>;
  readonly dispose: () => void;
}

/** Cache successful preparation, retry failed preparation, and dispose late
 * completions after page exit. Scene GPU/input ownership stays with App. */
export function createDeferredGameplay(load: () => Promise<GameplayClient>) {
  let pending: Promise<GameplayClient> | null = null;
  let ready: GameplayClient | null = null;
  let disposed = false;
  return Object.freeze({
    loadGameplay: (): Promise<GameplayClient> => {
      if (disposed) return Promise.reject(new Error('The module client has been disposed.'));
      if (pending) return pending;
      pending = Promise.resolve()
        .then(() => {
          if (disposed) throw new Error('The module client has been disposed.');
          return load();
        })
        .then(client => {
          if (disposed) {
            client.spatial.dispose();
            throw new Error('The module client has been disposed.');
          }
          try {
            TravelPresentationOptionsSchema.parse(
              client.GameplayPresentation.travelPresentation ?? { departureDurationMs: 0 }
            );
          } catch (error) {
            client.spatial.dispose();
            throw error;
          }
          ready = client;
          return client;
        })
        .catch(error => {
          pending = null;
          throw error;
        });
      return pending;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      ready?.spatial.dispose();
      ready = null;
    },
  });
}
