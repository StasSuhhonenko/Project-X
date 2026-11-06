/** Maintained C4 source policies. The engine owns actor identities, candidate
 * state, ordering and persistence; this module supplies only frozen bounded
 * decisions authenticated by docs/C4_SPECIAL_EFFECTS.md and its source probes.
 * Additional equipment channels and installation remain C5-owned. */
import {
  SpecialWeaponDefinitionSchema,
  type PulsePolicy,
  type SpecialEffectSlotsContext,
  type SpecialWeaponDefinition,
} from '@engine/simulation/contracts/special-weapon-rules';

const pulse = (
  effectDefinitionId: string,
  growthPerTick: number,
  fadePerTick: number,
  fadeAfterScalePercent: number,
  minimumAlphaPercent: number,
  overrides: Partial<PulsePolicy> = {}
): SpecialWeaponDefinition =>
  SpecialWeaponDefinitionSchema.parse({
    kind: 'pulse',
    effectDefinitionId,
    energyDebitMultiplier: effectDefinitionId === 'thaleron' ? 2 : 1,
    // Factories attach at298/195; the player artwork registers at298.6/195.5.
    emissionOffset: { x: -0.6, y: -0.5 },
    initialCursor: null,
    policy: {
      initialScalePercent: 1,
      growthPerTick,
      fadeAfterScalePercent,
      fadePerTick,
      minimumAlphaPercent,
      alphaQuantumPercent: 100 / 256,
      scanCountPerTick: 1,
      resetCursorAfterScalePercent: null,
      resetCursorAt: 1,
      engineDisableFrames: 0,
      reveal: false,
      hitFlagAmount: 0,
      playerHitFlagAmount: 0,
      standingDeltaPerOverlap: 0,
      ...overrides,
    },
  });

const policies = new Map<number, SpecialWeaponDefinition>([
  [22, SpecialWeaponDefinitionSchema.parse({ kind: 'cloak', energyDebitMultiplier: 1 })],
  [
    23,
    pulse('shockwave', 2, 3, 100, 10, {
      // numstations is already the next unused station slot; source adds one
      // again, intentionally skipping the first mobile actor in this visit.
      resetCursorAt: 'after-stations',
      resetCursorOffset: 1,
      engineDisableFrames: 200,
    }),
  ],
  [24, pulse('tachyon', 5, 5, 100, 1, { reveal: true })],
  [
    25,
    SpecialWeaponDefinitionSchema.parse({
      kind: 'tractor',
      effectDefinitionId: 'tractor',
      energyDebitMultiplier: 1,
      // The source compares target stage coordinates with296/191, preserving
      // both camera-pivot and zoom-dependent player-registration differences.
      range: {
        perAxis: 300,
        space: 'stage',
        originOffset: { x: -2, y: -4 },
        originOffsetPerZoom: { x: -0.6, y: -0.5 },
      },
      firstResetAgeTicks: 2,
      resetIntervalTicks: 1,
      resetCount: 58,
      maximumAgeTicks: 62,
    }),
  ],
  [
    26,
    pulse('thaleron', 0.5, 20, 150, 1, {
      scanCountPerTick: 9,
      resetCursorAfterScalePercent: 20,
      hitFlagAmount: 100,
      playerHitFlagAmount: 10,
      standingDeltaPerOverlap: -1,
    }),
  ],
  // Source dispatch charges once although neither factory maps this ID. An
  // invented projectile would change recovered behavior and is not authorized.
  [27, SpecialWeaponDefinitionSchema.parse({ kind: 'no-effect', energyDebitMultiplier: 1 })],
]);

export function getSpecialWeapon(weaponDefinitionId: number): SpecialWeaponDefinition | null {
  return policies.get(weaponDefinitionId) ?? null;
}

/** Source xArray0 identifies the NEXT unused slot, so one trailing undefined
 * query is deliberate. Canonical lifetime slots preserve dead actors as holes;
 * generation appends new identities without redirecting a tractor target. */
export function selectSpecialEffectSlots(context: SpecialEffectSlotsContext): readonly (string | null)[] {
  return Object.freeze([...context.actorSpawnSlots, null]);
}
