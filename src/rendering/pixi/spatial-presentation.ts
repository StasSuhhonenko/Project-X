/** Selected Pixi adapter. Preparation owns asset leases; the attached view owns
 * scene nodes/listeners. All cache lifetime is scoped to this factory instance. */
import { Assets } from 'pixi.js';
import { selectPlayerEntity } from '../../simulation/model/world-state';
import { PlayerSpatialViewSchema } from '../../ui/player-spatial-view';
import type { SpatialAttachment, SpatialPresentation } from '../contracts/spatial-presentation';
import { entityVisualSize } from '../pixi/entity-visual-size';
import type { ParallaxLayer } from '../shared/parallax-layer';
import { playerGeometry } from '../shared/player-geometry';
import type { PixiSceneDefinition as GameModuleDefinition } from './configuration';
import { createPixiGameView } from './pixi-game-view';
import { sceneAssetPaths } from './scene-asset-paths';

export interface PixiSceneDecoration {
  backgroundImageForSystem(systemId: number): string;
  parallaxLayersForSystem?(systemId: number, seed: number): readonly ParallaxLayer[];
}

export function createPixiSpatialPresentation(
  definition: GameModuleDefinition,
  decoration?: PixiSceneDecoration
): SpatialPresentation {
  const cache = new Map<string, { references: number; loaded: Promise<unknown> }>();
  let disposed = false;
  const release = (paths: readonly string[]) =>
    paths.forEach(path => {
      const entry = cache.get(path);
      if (!entry || --entry.references > 0) return;
      cache.delete(path);
      // Release only after an outstanding library load settles. A newer lease of
      // the same URL takes ownership of Pixi's shared texture before unload.
      void entry.loaded
        .then(
          () => {
            if (!cache.has(path)) return Assets.unload(path);
          },
          () => undefined
        )
        .catch(() => undefined);
    });
  return Object.freeze({
    projectPlayer: world => {
      const player = selectPlayerEntity(world);
      const visual = definition.visuals.entities.find(item => item.entityDefinitionId === player.definitionId);
      if (!visual) throw new Error('Player overlay visual is unavailable.');
      return PlayerSpatialViewSchema.parse(
        playerGeometry(
          definition.viewport,
          entityVisualSize(visual, 'player'),
          player.location.rotationDegrees,
          world.cameraZoom
        )
      );
    },
    prepareScene: async request => {
      if (disposed || request.signal.aborted) throw new Error('Spatial preparation was cancelled.');
      const systemId = selectPlayerEntity(request.world).location.systemId;
      const backgroundImage = decoration?.backgroundImageForSystem(systemId);
      const parallaxLayers = decoration?.parallaxLayersForSystem?.(systemId, request.cosmeticSeed);
      const paths = [
        ...new Set([
          ...sceneAssetPaths(request.world, definition).map(path => `/game/${path}`),
          ...(backgroundImage ? [backgroundImage] : []),
          ...(parallaxLayers?.map(layer => layer.image) ?? []),
        ]),
      ];
      paths.forEach(path => {
        const entry = cache.get(path);
        if (entry) {
          entry.references += 1;
          return;
        }
        cache.set(path, { references: 1, loaded: Promise.resolve().then(() => Assets.load(path)) });
      });
      try {
        await Promise.all(paths.map(path => cache.get(path)!.loaded));
        if (disposed || request.signal.aborted) throw new Error('Spatial preparation was cancelled.');
      } catch (error) {
        release(paths);
        throw error;
      }
      let released = false;
      return Object.freeze({
        attach: async ({ host, source, intents }: SpatialAttachment) => {
          if (released || disposed || request.signal.aborted) throw new Error('Prepared scene is no longer available.');
          const view = await createPixiGameView(
            host,
            {
              getState: () => ({ ...source.getState(), selectTarget: intents.selectTarget }),
              subscribe: source.subscribe,
            },
            definition,
            {
              ...(backgroundImage ? { backgroundImage } : {}),
              ...(parallaxLayers ? { parallaxLayers } : {}),
              onActivate: intents.activate,
            }
          );
          return {
            render: view.render,
            reset: view.reset,
            setPlayerVisible: view.setPlayerVisible,
            captureBackdrop: view.captureBackdrop,
            dispose: view.destroy,
          };
        },
        dispose: () => {
          if (released) return;
          released = true;
          release(paths);
        },
      });
    },
    dispose: () => {
      disposed = true;
    },
  } satisfies SpatialPresentation);
}
