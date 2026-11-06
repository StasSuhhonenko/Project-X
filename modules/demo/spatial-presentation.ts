import type { GameModuleDefinition } from '../../src/content/schemas/game-module';
import { createThreeSpatialPresentation } from '../../src/rendering/three/spatial-presentation';
import { loadThreeConfiguration } from '../../src/rendering/three/configuration';

/** Trusted local code explicitly selects Three; JSON provides data only. */
export async function createSpatialPresentation(definition: GameModuleDefinition) {
  return createThreeSpatialPresentation(definition, await loadThreeConfiguration(definition));
}
