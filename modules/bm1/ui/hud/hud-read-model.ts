/** Formatting and display masks derived solely from validated, read-only host
 * values. These are source output writers, never resource/rule mutations. */
import type { GameModuleDefinition } from '@engine/content/schemas/game-module';
import type { EquipmentView } from '@engine/ui/equipment-view';
import type { GameHudView } from '@engine/ui/game-hud-view';
import { energyCapacity } from '../../energy-capacity';
import { INITIAL_POWER_ALLOCATION_PERCENT } from '../../power-allocation';

/** Formats live source resource/cargo writers and black cover percentages.
 * Inputs are immutable host values and validated module definitions. Returned
 * records are frozen and never own gameplay state. Missing vessel definitions
 * or nonpositive capacities throw for the module's visible failure boundary.
 * Source surplus/deficit cover values intentionally remain outside 0..100. */
export function createHudReadModel(
  hud: GameHudView,
  definition: GameModuleDefinition,
  equipment: EquipmentView | null = null
) {
  const vessel = definition.content.entityDefinitions.find(
    vessel => vessel.id === hud.playerDefinitionId && vessel.category === 'ship'
  );
  if (!vessel || vessel.category !== 'ship') throw new Error('HUD vessel definition is unavailable');
  const resource = (id: string) => hud.resources[id] ?? 0;
  const fuelDays = resource('antimatter') * 2 * vessel.fuelEfficiency;
  const percentageMask = (current: number, total: number) => {
    if (!Number.isFinite(total) || total <= 0) throw new Error('HUD meter requires positive capacity');
    // Source masks deliberately retain negative/overscale results. Clamping
    // here would silently change valid original surplus/deficit presentation.
    return 100 - (current / total) * 100;
  };
  const reload = definition.content.weaponDefinitions.find(
    weapon => weapon.id === hud.weaponDefinitionId
  )?.cooldownFrames;
  const channelMask = (index: number) => {
    const channel = equipment?.channels[index];
    const weapon = definition.content.weaponDefinitions.find(w => w.id === channel?.weaponDefinitionId);
    if (!channel || !weapon) return 100;
    const duration = weapon.cooldownFrames * (channel.hasFired ? Math.max(0, 6 - vessel.sizeClass) : 1);
    return duration > 0 ? (channel.cooldownRemainingFrames / duration) * 100 : 100;
  };
  const gauges = Object.freeze({
    hullbar: Object.freeze({ label: 'Hull', current: hud.hull, maximum: vessel.maximumHull }),
    shieldsbar: Object.freeze({ label: 'Shields', current: hud.shields, maximum: vessel.maximumShields }),
    energybar: Object.freeze({ label: 'Energy', current: hud.energy, maximum: energyCapacity(vessel.cargoCapacity) }),
    cargobar: Object.freeze({ label: 'Cargo tons', current: hud.cargoUsed, maximum: vessel.cargoCapacity }),
    fuelbar: Object.freeze({ label: 'Fuel days', current: fuelDays, maximum: vessel.sizeClass * 100 }),
  });
  return Object.freeze({
    resources: `Latinum: ${resource('latinum')} bars\nDeuranium: ${resource('deuranium')} units\nMatter/Antimatter: ${resource('antimatter')} units\n   ${fuelDays} days of fuel.`,
    cargo: `Cargo hold ${Math.floor((hud.cargoUsed / vessel.cargoCapacity) * 100)}% full with ${vessel.cargoCapacity - hud.cargoUsed} tons remaining.`,
    gauges,
    masks: Object.freeze({
      hullbar: percentageMask(hud.hull, vessel.maximumHull),
      shieldsbar: percentageMask(hud.shields, vessel.maximumShields),
      energybar: percentageMask(hud.energy, energyCapacity(vessel.cargoCapacity)),
      cargobar: percentageMask(hud.cargoUsed, vessel.cargoCapacity),
      // Page1:25841 denominator is Number(the one-based size field *100).
      fuelbar: percentageMask(fuelDays, vessel.sizeClass * 100),
      weapon1bar: equipment
        ? channelMask(0)
        : reload && reload > 0
          ? (hud.cooldownRemainingFrames / reload) * 100
          : 100,
      weapon2bar: channelMask(1),
      weapon3bar: channelMask(2),
      // UI-13 covers: Symbol 6:56602 `_yscale = 100 - ops*`. Allocations are the
      // fixed source defaults until C17 ports the OPS controls.
      opsreservesbar: 100 - INITIAL_POWER_ALLOCATION_PERCENT.reserves,
      opsenginesbar: 100 - INITIAL_POWER_ALLOCATION_PERCENT.engines,
      opsweaponsbar: 100 - INITIAL_POWER_ALLOCATION_PERCENT.weapons,
      opsshieldsbar: 100 - INITIAL_POWER_ALLOCATION_PERCENT.shields,
    }),
  });
}
