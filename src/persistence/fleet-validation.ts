/** Validate capability-dependent fleet content without spawning or drawing. */
import type { GameModule } from '../content/game-module';
import type { WorldState } from '../simulation/model/world-state';

export function validateSavedFleet(world: WorldState, game: GameModule): void {
  const rules = game.rules.fleet;
  const present = Object.hasOwn(world, 'fleet');
  const management = rules?.management;
  if (
    world.entities.some(
      actor =>
        actor.kind === 'npc-ship' &&
        actor.departure?.notice === null &&
        (!management ||
          actor.governmentId !== rules.ownedGovernmentId ||
          actor.departure.durationTicks !== management.declarations.departureTicks)
    )
  )
    throw Error('Saved silent departure requires fleet management, owned allegiance and the declared warp duration.');
  if (!rules) {
    if (present) throw Error('Saved fleet requires the module capability.');
    return;
  }
  const fleet = world.fleet;
  if (!present || !fleet) throw Error('Fleet capability requires saved fleet state.');
  // Current allegiance, rather than birth provenance, is authoritative after
  // capture/release. A validated silent departure is the only owned-government
  // actor allowed to remain after its deployment has ended.
  if (
    world.entities.some(
      actor =>
        actor.kind === 'npc-ship' &&
        actor.governmentId === rules.ownedGovernmentId &&
        actor.departure?.notice !== null &&
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
