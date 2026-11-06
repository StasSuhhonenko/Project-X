/** Local asynchronous model preparation. No process-global model cache exists;
 * each prepared owner retains its geometry until the host releases its leases. */
import { LoadingManager } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GameModuleDefinition } from '../../content/schemas/game-module';
import type { SpatialPresentation, SpatialAttachment } from '../contracts/spatial-presentation';
import type { ThreeSpatialConfiguration } from './configuration';
import { validateSelfContainedGlb } from './glb-validation';
import { disposeLoadedModel } from './resources';
import { createThreeGameView } from './three-game-view';

export function createThreeSpatialPresentation(game: GameModuleDefinition,
  config: ThreeSpatialConfiguration, fetcher: typeof fetch = fetch): SpatialPresentation {
  let disposed = false;
  return Object.freeze({
    // This demo uses semantic heading and text rather than a 2D actor overlay.
    prepareScene: async request => {
      if (disposed || request.signal.aborted) throw new Error('Three preparation was cancelled.');
      const response = await fetcher(`/game/${config.model}`, { signal: request.signal });
      if (!response.ok) throw new Error(`Could not load local model: HTTP ${response.status}.`);
      const bytes = await response.arrayBuffer();
      validateSelfContainedGlb(bytes);
      const manager = new LoadingManager();
      manager.setURLModifier(() => { throw new Error('External model resources are forbidden.'); });
      const model = await new GLTFLoader(manager).parseAsync(bytes, '');
      if (disposed || request.signal.aborted) {
        disposeLoadedModel(model.scene);
        throw new Error('Three preparation was cancelled.');
      }
      let released = false;
      return Object.freeze({
        attach: async (context: SpatialAttachment) => {
          if (released || disposed || request.signal.aborted) throw new Error('Prepared model is no longer available.');
          return createThreeGameView(context, game, config, model.scene);
        },
        dispose: () => {
          if (released) return;
          released = true;
          disposeLoadedModel(model.scene);
        },
      });
    },
    dispose: () => { disposed = true; },
  } satisfies SpatialPresentation);
}
