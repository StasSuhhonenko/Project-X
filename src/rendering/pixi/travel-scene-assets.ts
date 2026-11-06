/** Preload the exact destination images needed by the current Pixi scene. */
import { Assets } from 'pixi.js';
import type { PixiSceneDefinition as GameModuleDefinition } from './configuration';
import type { WorldState } from '../../simulation/model/world-state';
import { sceneAssetPaths } from './scene-asset-paths';

/** Reject missing mappings or failed image requests before travel charges fuel. */
export async function preloadTravelScene(world: WorldState, definition: GameModuleDefinition): Promise<void> {
  await Promise.all(sceneAssetPaths(world, definition).map(path => Assets.load(`/game/${path}`)));
}
