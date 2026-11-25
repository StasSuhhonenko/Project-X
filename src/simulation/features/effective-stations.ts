/** Sole authored/constructed placement join. Pending markers never expose
 * services; destroyed records never participate. Array order is creation order. */
import type { GameModule } from '../../content/game-module';
import type { GameModuleDefinition, SystemDefinition } from '../../content/schemas/game-module';
import { ConstructedStationServicesSchema } from '../contracts/construction-rules';
import type { ConstructionState } from '../model/construction-state';

export function effectiveStations(
  system: SystemDefinition,
  construction: ConstructionState | undefined,
  rules: GameModule['rules']['construction'],
  historicalStationIds: readonly string[] = []
): SystemDefinition['stations'] {
  if (!construction || !rules) return system.stations;
  return Object.freeze([
    ...system.stations,
    ...construction.stations.flatMap(station => {
      if (
        station.systemId !== system.id ||
        (station.phase.kind !== 'complete' &&
          !(
            station.phase.kind === 'destroyed' &&
            historicalStationIds.includes(station.id) &&
            construction.deployments.some(link => link.stationId === station.id)
          ))
      )
        return [];
      return [
        Object.freeze({
          id: station.id,
          name: station.name,
          structureDefinitionId: station.structureDefinitionId,
          positionOffset: station.positionOffset,
          rotationDegrees: station.rotationDegrees,
          destinationSystemId: station.destinationSystemId,
          ...ConstructedStationServicesSchema.parse(rules.stationServices(station.structureDefinitionId)),
        }),
      ];
    }),
  ]);
}

/** Policy contexts receive the same effective placements as engine consumers. */
export function effectiveSystem(
  world: { readonly construction?: ConstructionState | undefined },
  game: Pick<GameModule, 'rules'>,
  system: SystemDefinition,
  historicalStationIds: readonly string[] = []
): SystemDefinition {
  return Object.freeze({
    ...system,
    stations: effectiveStations(system, world.construction, game.rules.construction, historicalStationIds),
  });
}

/** Presentation data for both the current system and destination preloading.
 * The authored definition remains the authority for the renderer and saves. */
export function effectivePresentationDefinition(
  construction: ConstructionState | undefined,
  game: Pick<GameModule, 'definition' | 'rules'>
): GameModuleDefinition {
  if (!construction?.stations.some(station => station.phase.kind === 'complete')) return game.definition;
  return Object.freeze({
    ...game.definition,
    systems: Object.freeze(game.definition.systems.map(system => effectiveSystem({ construction }, game, system))),
  });
}
