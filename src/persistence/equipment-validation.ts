/** Content-aware equipment validation at the untrusted save boundary. */
import type { GameModule } from '../content/game-module';
import { canUseOwnedWeapon, equipmentArmaments } from '../simulation/model/equipment-state';
import { selectPlayerEntity, type WorldState } from '../simulation/model/world-state';
export function validateSavedEquipment(world: WorldState, game: GameModule): void {
  const player = selectPlayerEntity(world), equipment = player.equipment, config = game.definition.equipment;
  if (!config) { if (equipment) throw Error('Saved equipment is unavailable in this module.'); return; }
  if (!equipment || equipment.ownedWeaponIds.length !== config.inventoryCapacity
    || equipment.ownedWeaponIds.some(id => id !== null && !config.supportedWeaponIds.includes(id))
    || equipment.technologyWeaponIds.some(id => !config.technologyWeaponIds.includes(id))
    || equipmentArmaments(player).some(channel => channel.weaponDefinitionId !== null && !game.catalog.getWeaponDefinition(channel.weaponDefinitionId)))
    throw Error('Saved equipment differs from supported ownership or channels.');
  const system = game.definition.systems.find(s => s.id === player.location.systemId);
  if (!system || (game.rules.validateEquipmentMarket && game.rules.validateEquipmentMarket(system, equipment.marketAdjustment) !== true))
    throw Error('Saved equipment market adjustment is inconsistent.');
  if (equipment.ownedWeaponIds.some(id => id !== null && (!supportsSavedLaunch(game, player.definitionId, id)
    || (config.technologyWeaponIds.includes(id) && !game.catalog.getShipDefinition(player.definitionId)!.startingWeaponIds.includes(id)))))
    throw Error('Saved equipment exceeds the active vessel capability.');
}

/** Emitted effects retain their captured hull after refit or equipment sale.
 * They may have come from any installed supported channel, not only defaults. */
export function supportsSavedLaunch(game: GameModule, vesselId: number, weaponId: number): boolean {
  const vessel = game.catalog.getShipDefinition(vesselId), weapon = game.catalog.getWeaponDefinition(weaponId);
  if (!vessel || !weapon) return false;
  return vessel.startingWeaponIds.includes(weaponId)
    || (game.definition.equipment?.supportedWeaponIds.includes(weaponId) === true && canUseOwnedWeapon(vessel, weapon));
}
