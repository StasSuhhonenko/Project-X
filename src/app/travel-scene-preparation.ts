/** Asynchronous travel preflight with a caller-owned cancellation predicate. */
import type { GameModuleDefinition } from '../content/schemas/game-module';
import type { WorldState } from '../simulation/model/world-state';
import { preloadTravelScene } from '../rendering/travel-scene-assets';

/**
 * A completed asset request may outlive its scene or starting world. The caller
 * checks the returned flag immediately before its single authoritative commit.
 */
export async function prepareTravelScene(
  destination: WorldState,
  definition: GameModuleDefinition,
  isCurrent: () => boolean,
  load: typeof preloadTravelScene = preloadTravelScene,
): Promise<boolean> {
  await load(destination, definition);
  return isCurrent();
}
