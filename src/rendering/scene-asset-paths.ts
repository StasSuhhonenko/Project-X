/** One asset inventory for scene creation and precommit travel readiness. */
import type { GameModuleDefinition } from '../content/schemas/game-module';
import { selectPlayerEntity, type WorldState } from '../simulation/model/world-state';

/**
 * Include living actors and every ship this system's lifecycle may generate.
 * Loading those bounded capabilities before play avoids asynchronous texture
 * acquisition during an already committed death. Paths are module-owned; shared
 * code knows no ship identities. Duplicates share Pixi's cached texture.
 */
export function sceneAssetPaths(world: WorldState, definition: GameModuleDefinition): readonly string[] {
  const entityImage = (definitionId: number): string => {
    const visual = definition.visuals.entities.find(candidate => candidate.entityDefinitionId === definitionId);
    if (!visual) throw new Error(`Scene entity definition ${definitionId} has no visual.`);
    return visual.image;
  };
  const paths = world.entities.map(entity => {
    if (entity.kind !== 'planet') return entityImage(entity.definitionId);
    const system = definition.systems.find(candidate => candidate.id === entity.location.systemId);
    const visual = definition.visuals.planets.find(candidate => candidate.visualTypeId === system?.planet.visualTypeId);
    if (!visual) throw new Error('Scene planet visual is missing.');
    return visual.image;
  });
  const player = selectPlayerEntity(world);
  const beam = definition.visuals.weaponBeams.find(candidate => candidate.weaponDefinitionId === player.armament.weaponDefinitionId);
  if (beam) paths.push(beam.image);
  const lifecycle = definition.lifecycle;
  if (lifecycle?.stationRecords.some(record => record.homeSystemId === player.location.systemId)) {
    paths.push(...lifecycle.spawnShipDefinitionIds.map(entityImage));
  }
  return Object.freeze([...new Set(paths)]);
}
