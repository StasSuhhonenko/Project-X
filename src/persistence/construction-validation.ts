/** Content-aware disjoint-union proof. Authored validation stays strict; this
 * owner separately proves dynamic records, placements, services and live links. */
import { isBuildableStructure } from '../content/construction-eligibility';
import type { GameModule } from '../content/game-module';
import { selectPlayerEntity, type WorldState } from '../simulation/model/world-state';

export function validateSavedConstruction(world: WorldState, game: GameModule): void {
  const rules = game.rules.construction,
    state = world.construction;
  if (!rules) {
    if (
      state ||
      world.constructionArrivalNotices ||
      world.entities.some(entity => entity.kind === 'station' && entity.construction)
    )
      throw Error('Save has undeclared construction capability.');
    return;
  }
  if (!state || state.plans.length !== rules.planCapacity)
    throw Error('Saved construction inventory differs from capability.');
  const requireStructure = (id: number) => {
    const definition = game.catalog.getStructureDefinition(id);
    if (!isBuildableStructure(definition)) throw Error('Saved construction definition is unavailable.');
    return definition;
  };
  state.plans.forEach(id => {
    if (id !== null) requireStructure(id);
  });
  const authoredIds = new Set(game.definition.systems.flatMap(system => system.stations.map(station => station.id)));
  state.stations.forEach(station => {
    const definition = requireStructure(station.structureDefinitionId);
    const system = game.definition.systems.find(system => system.id === station.systemId);
    if (
      !system ||
      authoredIds.has(station.id) ||
      (station.destinationSystemId !== null &&
        !game.definition.systems.some(system => system.id === station.destinationSystemId))
    )
      throw Error('Saved construction identity or destination is unavailable.');
    const link = state.deployments.find(link => link.stationId === station.id);
    const actor = world.entities.find(entity => entity.id === link?.entityId);
    const present =
      station.phase.kind !== 'destroyed' && station.systemId === selectPlayerEntity(world).location.systemId;
    if (!present) {
      if (
        link &&
        (station.phase.kind !== 'destroyed' ||
          station.systemId !== selectPlayerEntity(world).location.systemId ||
          actor ||
          Number(link.entityId.slice(7)) >= world.nextEntitySequence)
      )
        throw Error('Inactive construction record has an invalid historical deployment.');
      return;
    }
    if (
      actor?.kind !== 'station' ||
      actor.stationId !== station.id ||
      actor.definitionId !== station.structureDefinitionId ||
      actor.location.systemId !== station.systemId ||
      actor.location.rotationDegrees !== station.rotationDegrees ||
      actor.location.position.x !== system.planet.placement.position.x + station.positionOffset.x ||
      actor.location.position.y !== system.planet.placement.position.y + station.positionOffset.y
    )
      throw Error('Saved construction placement disagrees with its record.');
    if (station.phase.kind === 'pending') {
      if (actor.construction !== 'pending' || actor.combat || actor.commodityMarket)
        throw Error('Saved pending site is not inert.');
      return;
    }
    if (
      actor.construction ||
      !actor.combat ||
      actor.combat.recordId !== station.id ||
      actor.combat.maximumStrength !== definition.maximumHull + definition.maximumShields
    )
      throw Error('Saved completed station combat is invalid.');
  });
  world.entities.forEach(entity => {
    if (entity.kind !== 'station') return;
    const record = state.stations.find(station => station.id === entity.stationId);
    if (record && !state.deployments.some(link => link.stationId === record.id && link.entityId === entity.id))
      throw Error('Saved dynamic actor has no matching deployment.');
  });
}
