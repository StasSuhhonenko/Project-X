import type { GameModuleDefinition } from '@engine/content/schemas/game-module';
import { loadThreeConfiguration } from '@engine/rendering/three/configuration';
import { createThreeSpatialPresentation } from '@engine/rendering/three/spatial-presentation';

/** Trusted local code explicitly selects Three; JSON provides data only. */
export async function createSpatialPresentation(definition: GameModuleDefinition) {
  return createThreeSpatialPresentation(definition, await loadThreeConfiguration(definition));
}
