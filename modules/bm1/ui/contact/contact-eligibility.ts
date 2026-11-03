/** Source planet.hittest(player) is an axis-aligned displayed-bounds test.
 * This only gates contact attachment; paid actions keep host revalidation. */
import type { GameModuleDefinition } from '../../../../src/content/schemas/game-module';
import type { PlanetContactView } from '../../../../src/ui/contact-view';
import type { PlayerSpatialView } from '../../../../src/ui/player-spatial-view';
import { worldToScreen } from '../../../../src/rendering/world-camera';

export function canHailPlanet(contact: PlanetContactView, player: PlayerSpatialView, definition: GameModuleDefinition): boolean {
  const system = definition.systems.find(system => system.id === contact.systemId);
  const visual = definition.visuals.planets.find(visual => visual.visualTypeId === system?.planet.visualTypeId);
  if (!system || !visual) return false;
  const point = worldToScreen({ x:contact.relativeX, y:contact.relativeY }, { x:0, y:0 }, definition.viewport, player.zoom);
  const width = visual.nativeSize.width * system.planet.displayScalePercent / 100 / player.zoom;
  const height = visual.nativeSize.height * system.planet.displayScalePercent / 100 / player.zoom;
  return point.x - visual.pivot.x * width <= player.x + player.boundsWidth / 2
    && point.x + (1 - visual.pivot.x) * width >= player.x - player.boundsWidth / 2
    && point.y - visual.pivot.y * height <= player.y + player.boundsHeight / 2
    && point.y + (1 - visual.pivot.y) * height >= player.y - player.boundsHeight / 2;
}
