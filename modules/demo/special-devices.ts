/** Authored survey devices, independent of recovered compatibility behavior.
 * The ring uses continuous opacity, a large initial radius and short refreshed
 * holds. Device identifiers belong to this module's content namespace. */
import { SpecialWeaponDefinitionSchema } from '@engine/simulation/contracts/special-weapon-rules';

const devices = new Map([
  [
    103,
    SpecialWeaponDefinitionSchema.parse({
      kind: 'pulse',
      effectDefinitionId: 'survey-ring',
      energyDebitMultiplier: 1,
      initialCursor: 0,
      policy: {
        initialScalePercent: 40,
        growthPerTick: 12,
        fadeAfterScalePercent: 120,
        fadePerTick: 2,
        minimumAlphaPercent: 1,
        alphaQuantumPercent: 0,
        scanCountPerTick: 1,
        resetCursorAfterScalePercent: null,
        resetCursorAt: 0,
        engineDisableFrames: 12,
        reveal: true,
        hitFlagAmount: 0,
        playerHitFlagAmount: 0,
        standingDeltaPerOverlap: 0,
      },
    }),
  ],
  [104, SpecialWeaponDefinitionSchema.parse({ kind: 'cloak', energyDebitMultiplier: 1 })],
  [
    105,
    SpecialWeaponDefinitionSchema.parse({
      kind: 'tractor',
      effectDefinitionId: 'survey-tether',
      energyDebitMultiplier: 1,
      firstResetAgeTicks: 2,
      resetIntervalTicks: 2,
      resetCount: 4,
      maximumAgeTicks: 10,
    }),
  ],
]);

/** Unknown IDs remain ordinary weapons; validated device definitions are frozen. */
export const getSpecialWeapon = (id: number) => devices.get(id) ?? null;
