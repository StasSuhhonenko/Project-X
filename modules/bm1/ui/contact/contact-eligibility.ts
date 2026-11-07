/** Source planet.hittest(player) is an axis-aligned displayed-bounds test.
 * This only gates contact attachment; paid actions keep host revalidation. */
import type { PixiSceneDefinition as GameModuleDefinition } from '@engine/rendering/pixi/configuration';
import type { PlanetContactView } from '@engine/ui/contact-view';
import type { PlayerSpatialView } from '@engine/ui/player-spatial-view';
import { overlapsPlanet } from '../../planet-overlap';

export function canHailPlanet(
  contact: PlanetContactView,
  player: PlayerSpatialView,
  definition: GameModuleDefinition
): boolean {
  const system = definition.systems.find(system => system.id === contact.systemId);
  if (!system) return false;
  return overlapsPlanet(system, { x: contact.relativeX, y: contact.relativeY }, player);
}
