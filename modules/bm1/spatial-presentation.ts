/** Module-owned decoration and adapter choice; independent cosmetic randomness
 * is supplied once by the host request and never consumes gameplay RNG. */
import type { PixiSceneDefinition as GameModuleDefinition } from '@engine/rendering/pixi/configuration';
import { createPixiSpatialPresentation } from '@engine/rendering/pixi/spatial-presentation';
import { createSunPlacement } from './ui/viewport/sun-placement';
import { backgroundFile, viewportAsset, viewportContent } from './ui/viewport/viewport-content';

export function createSpatialPresentation(definition: GameModuleDefinition) {
  return createPixiSpatialPresentation(definition, {
    backgroundImageForSystem: systemId => viewportAsset(backgroundFile(systemId)),
    parallaxLayersForSystem: (_systemId, seed) => {
      const sun = viewportContent.sun;
      return [
        Object.freeze({
          image: viewportAsset(sun.file),
          ...createSunPlacement(seed),
          width: sun.width,
          height: sun.height,
          parallax: sun.parallax,
        }),
      ];
    },
  });
}
