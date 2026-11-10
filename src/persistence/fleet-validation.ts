/** Validate capability-dependent fleet content without spawning or drawing. */
import type { GameModule } from '../content/game-module';
import type { WorldState } from '../simulation/model/world-state';

export function validateSavedFleet(world: WorldState, game: GameModule): void {
  const rules = game.rules.fleet;
  const present = Object.hasOwn(world, 'fleet');
  if (!rules) {
    if (present) throw Error('Saved fleet requires the module capability.');
    return;
  }
  const fleet = world.fleet;
  if (!present || !fleet) throw Error('Fleet capability requires saved fleet state.');
  fleet.ships.forEach(ship => {
    if (
      !game.catalog.getShipDefinition(ship.definitionId) ||
      !game.definition.systems.some(system => system.id === ship.systemId) ||
      !game.definition.combatGeometry.entities.some(row => row.entityDefinitionId === ship.definitionId)
    )
      throw Error('Saved roster references unavailable hull geometry or system.');
  });
  fleet.deployments.forEach(link => {
    const actor = world.entities.find(actor => actor.id === link.entityId);
    if (actor?.kind !== 'npc-ship' || actor.governmentId !== rules.ownedGovernmentId)
      throw Error('Saved fleet deployment requires an owned-government actor.');
  });
}
