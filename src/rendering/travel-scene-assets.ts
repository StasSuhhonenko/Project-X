/** Preload the exact destination images needed by the current Pixi scene. */
import { Assets } from 'pixi.js';
import type { GameModuleDefinition } from '../content/schemas/game-module';
import type { WorldState } from '../simulation/model/world-state';

/** Reject missing mappings or failed image requests before travel charges fuel. */
export async function preloadTravelScene(world: WorldState, definition: GameModuleDefinition): Promise<void> {
  const paths = world.entities.map(entity => {
    if (entity.kind === 'planet') {
      const system = definition.systems.find(candidate => candidate.id === entity.location.systemId);
      const mapping = definition.visuals.planets.find(candidate => candidate.visualTypeId === system?.planet.visualTypeId);
      if (!mapping) throw new Error('Destination planet visual is missing.');
      return mapping.image;
    }
    const mapping = definition.visuals.entities.find(candidate => candidate.entityDefinitionId === entity.definitionId);
    if (!mapping) throw new Error(`Destination entity ${entity.id} has no visual.`);
    return mapping.image;
  });
  const player = world.entities.find(entity => entity.id === world.playerEntityId);
  if (player?.kind === 'player-ship') {
    const beam = definition.visuals.weaponBeams.find(candidate => candidate.weaponDefinitionId === player.armament.weaponDefinitionId);
    if (beam) paths.push(beam.image);
  }
  await Promise.all([...new Set(paths)].map(path => Assets.load(`/game/${path}`)));
}
