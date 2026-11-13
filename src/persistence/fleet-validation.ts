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
  // Current allegiance, rather than birth provenance, is authoritative after
  // capture/release. Ownership is bidirectional: every owned-government actor
  // must have a deployment, and every deployment must have owned government.
  if (
    world.entities.some(
      actor =>
        actor.kind === 'npc-ship' &&
        actor.governmentId === rules.ownedGovernmentId &&
        !fleet.deployments.some(link => link.entityId === actor.id)
    )
  )
    throw Error('Owned-government actor requires a fleet deployment.');
  fleet.ships.forEach(ship => {
    if (
      !game.catalog.getShipDefinition(ship.definitionId) ||
      (ship.systemId !== null && !game.definition.systems.some(system => system.id === ship.systemId)) ||
      !game.definition.combatGeometry.entities.some(row => row.entityDefinitionId === ship.definitionId)
    )
      throw Error('Saved roster references unavailable hull geometry or system.');
    if (!rules.orders && (ship.systemId === null || Object.hasOwn(ship, 'missionId')))
      throw Error('Stowing and missions require fleet orders.');
    if (
      rules.orders &&
      (!Object.hasOwn(ship, 'missionId') ||
        (ship.missionId !== null && !rules.orders.declaredMissions.includes(ship.missionId!)))
    )
      throw Error('Saved fleet mission must be null or declared.');
  });
  fleet.deployments.forEach(link => {
    if (!rules.orders && Object.hasOwn(link, 'orderId')) throw Error('Saved order requires fleet orders.');
    if (
      rules.orders &&
      (!Object.hasOwn(link, 'orderId') ||
        (link.orderId !== null && !rules.orders.declaredOrders.some(order => order.id === link.orderId)))
    )
      throw Error('Saved fleet order must be null or declared.');
    const actor = world.entities.find(actor => actor.id === link.entityId);
    if (actor?.kind !== 'npc-ship' || actor.governmentId !== rules.ownedGovernmentId)
      throw Error('Saved fleet deployment requires an owned-government actor.');
  });
}
