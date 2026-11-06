/** Module-owned decoration and adapter choice; independent cosmetic randomness
 * is supplied once by the host request and never consumes gameplay RNG. */
import type { PixiSceneDefinition as GameModuleDefinition } from '../../src/rendering/pixi/configuration';
import { createPixiSpatialPresentation } from '../../src/rendering/pixi/spatial-presentation';
import { viewportAsset, viewportContent, backgroundFile } from './ui/viewport/viewport-content';
import { createSunPlacement } from './ui/viewport/sun-placement';

export function createSpatialPresentation(definition: GameModuleDefinition) {
  return createPixiSpatialPresentation(definition, {
    backgroundImageForSystem: systemId => viewportAsset(backgroundFile(systemId)),
    parallaxLayersForSystem: (_systemId, seed) => {
      const sun = viewportContent.sun;
      return [Object.freeze({ image: viewportAsset(sun.file), ...createSunPlacement(seed),
        width: sun.width, height: sun.height, parallax: sun.parallax })];
    },
  });
}
