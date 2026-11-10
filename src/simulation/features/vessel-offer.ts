/** Authenticate a planet/selected-station offer and its authoritative geometry.
 * Shared by captain replacement and optional fleet acquisition; no pricing policy
 * is called here. Session currency is checked separately by the command host. */
import type { GameModule } from '../../content/game-module';
import { selectPlayerEntity, type WorldState } from '../model/world-state';

export function authenticateVesselOffer(
  world: WorldState,
  gameModule: GameModule,
  vesselDefinitionId: number,
  stationEntityId?: string
) {
  if (world.status !== 'active' || !Number.isSafeInteger(vesselDefinitionId)) return null;
  const player = selectPlayerEntity(world);
  if (player.condition.repairing) return null;
  const nextVessel = gameModule.catalog.getShipDefinition(vesselDefinitionId);
  const system = gameModule.definition.systems.find(system => system.id === player.location.systemId);
  const planet = world.entities.find(entity => entity.kind === 'planet');
  if (!nextVessel || !system || !planet) return null;
  const station =
    stationEntityId === undefined
      ? null
      : world.entities.find(
          entity => entity.kind === 'station' && entity.id === stationEntityId && entity.location.systemId === system.id
        );
  if (
    stationEntityId !== undefined &&
    (!station || station.kind !== 'station' || world.selectedTargetEntityId !== stationEntityId)
  )
    return null;
  const offeredIds =
    station?.kind === 'station'
      ? (system.stations.find(placement => placement.id === station.stationId)?.shipOffers ?? [])
      : system.planet.offeredEntityDefinitionIds;
  if (!offeredIds.includes(vesselDefinitionId)) return null;
  if (!gameModule.definition.combatGeometry.entities.some(visual => visual.entityDefinitionId === vesselDefinitionId))
    return null;
  return Object.freeze({
    player,
    nextVessel,
    system,
    planet,
    station,
    sourceKind: station ? ('station' as const) : ('planet' as const),
  });
}
