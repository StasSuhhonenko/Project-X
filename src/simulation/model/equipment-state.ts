/** Owned positions and firing channels are distinct. Duplicate definitions are
 * separate owned copies; a definition cannot occupy more channels than copies. */
import { z } from 'zod';
import { PrimaryWeaponStateSchema, createArmament, type PrimaryWeaponState } from './armament-state';
const WeaponId = z.number().int().positive();
export const EquipmentStateSchema = z.object({
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  ownedWeaponIds: z.array(WeaponId.nullable()).min(1).max(64).readonly(),
  technologyWeaponIds: z.array(WeaponId).max(64).readonly(),
  additionalArmaments: z.tuple([PrimaryWeaponStateSchema, PrimaryWeaponStateSchema]).readonly(),
  /** Sampled once on system entry, retained through save/reload and refits. */
  marketAdjustment: z.number().finite(),
}).strict().readonly();
export type EquipmentState = z.infer<typeof EquipmentStateSchema>;
export const FiringChannelSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export type FiringChannel = z.infer<typeof FiringChannelSchema>;
/** Authored default loadouts can contain exceptions to purchase-size gates.
 * Existing owned defaults remain usable; purchasing still checks minimum size. */
export function canUseOwnedWeapon(vessel: { readonly sizeClass: number; readonly startingWeaponIds: readonly (number | null)[] },
  weapon: { readonly id: number; readonly minimumSizeClass: number }): boolean {
  return vessel.sizeClass >= weapon.minimumSizeClass || vessel.startingWeaponIds.includes(weapon.id);
}
export function equipmentArmaments(player: { readonly armament: PrimaryWeaponState; readonly equipment: EquipmentState | null }): readonly PrimaryWeaponState[] {
  return Object.freeze([player.armament, ...(player.equipment?.additionalArmaments ?? [])]);
}
export function createEquipment(capacity: number, defaults: readonly (number | null)[], cooldown: (id: number) => number,
  marketAdjustment: number): EquipmentState {
  return EquipmentStateSchema.parse({
    revision: 0, ownedWeaponIds: Array.from({ length: capacity }, (_, i) => defaults[i] ?? null),
    technologyWeaponIds: [], marketAdjustment,
    additionalArmaments: [1, 2].map(i => createArmament(defaults[i] ?? null, defaults[i] ? cooldown(defaults[i]!) : 0)),
  });
}
/** This structural invariant is shared by commands and untrusted save parsing. */
export function hasOwnedEquipment(player: { readonly armament: PrimaryWeaponState; readonly equipment: EquipmentState | null }): boolean {
  const equipment = player.equipment;
  if (!equipment) return true;
  if (new Set(equipment.technologyWeaponIds).size !== equipment.technologyWeaponIds.length) return false;
  const ids = equipmentArmaments(player).map(a => a.weaponDefinitionId).filter(id => id !== null);
  return ids.every(id => ids.filter(equipped => equipped === id).length
    <= equipment.ownedWeaponIds.filter(owned => owned === id).length);
}
