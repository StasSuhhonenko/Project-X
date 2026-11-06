/** Declarative, validated special-device policy. Percentages are source display
 * units; lengths are world units. Launch captures these facts so refits cannot
 * rewrite an existing effect. No policy grants identity or mutation authority. */
import { z } from 'zod';
import { PositionSchema, RuntimeEntityIdSchema } from '../model/entity-components';
import type { NpcGeneration } from '../model/lifecycle-state';

const count = z.number().int().nonnegative().max(100000);
const percent = z.number().finite().nonnegative().max(100000);
export const PulsePolicySchema = z
  .object({
    initialScalePercent: percent,
    growthPerTick: z.number().finite().positive().max(1000),
    fadeAfterScalePercent: percent,
    fadePerTick: z.number().finite().positive().max(100),
    minimumAlphaPercent: z.number().finite().min(0).max(100),
    /** Zero means continuous alpha; otherwise quantize down after each debit. */
    alphaQuantumPercent: z.number().finite().min(0).max(100),
    scanCountPerTick: z.number().int().min(1).max(100),
    resetCursorAfterScalePercent: percent.nullable(),
    resetCursorAt: z.union([count, z.literal('after-stations')]),
    /** Module-owned offset from the declared reset base. Legacy skipped slots
     * belong in module data rather than in shared cursor arithmetic. */
    resetCursorOffset: count.optional(),
    engineDisableFrames: count,
    reveal: z.boolean(),
    hitFlagAmount: count,
    playerHitFlagAmount: count,
    standingDeltaPerOverlap: z.number().finite().min(-100000).max(100000),
  })
  .strict()
  .superRefine((policy, context) => {
    // Saved cursor replay is deliberately bounded. Reject a policy that would
    // retain an authoritative field for an impractical number of fixed ticks.
    const fadeStart = Math.max(
      1,
      Math.floor((policy.fadeAfterScalePercent - policy.initialScalePercent) / policy.growthPerTick) + 1
    );
    const maximumLeads = fadeStart + Math.ceil(100 / policy.fadePerTick) + 1;
    if (!Number.isFinite(maximumLeads) || maximumLeads > 100000)
      context.addIssue({
        code: 'custom',
        message: 'Pulse policy exceeds the supported 100000-lead continuation bound.',
      });
    if (policy.initialScalePercent + maximumLeads * policy.growthPerTick > 100000000)
      context.addIssue({ code: 'custom', message: 'Pulse policy exceeds the supported saved scale range.' });
  })
  .readonly();
export type PulsePolicy = z.infer<typeof PulsePolicySchema>;
const common = {
  energyDebitMultiplier: z.number().int().min(1).max(10),
};
export const SpecialWeaponDefinitionSchema = z.discriminatedUnion('kind', [
  z
    .object({ ...common, kind: z.literal('cloak') })
    .strict()
    .readonly(),
  z
    .object({ ...common, kind: z.literal('no-effect') })
    .strict()
    .readonly(),
  z
    .object({
      ...common,
      kind: z.literal('pulse'),
      effectDefinitionId: z.string().min(1),
      /** Captured once in world coordinates; omission means the emitter origin. */
      emissionOffset: PositionSchema.optional(),
      /** Null preserves a source undefined first query; increments become numeric. */
      initialCursor: count.nullable(),
      policy: PulsePolicySchema,
    })
    .strict()
    .readonly(),
  z
    .object({
      ...common,
      kind: z.literal('tractor'),
      effectDefinitionId: z.string().min(1),
      /** This check follows payment/acceptance: a range miss still consumes the
       * command. Optional offsets describe distinct stage/camera registrations. */
      range: z
        .object({
          /** Strict X/Y threshold in the selected coordinate space. */
          perAxis: z.number().finite().positive().max(100000),
          space: z.enum(['world', 'stage']),
          /** Registration offset in that space, plus an optional zoom-scaled part. */
          originOffset: PositionSchema,
          originOffsetPerZoom: PositionSchema.optional(),
        })
        .strict()
        .readonly()
        .optional(),
      firstResetAgeTicks: count,
      resetIntervalTicks: z.number().int().positive().max(100000),
      resetCount: z.number().int().positive().max(100000),
      maximumAgeTicks: z.number().int().positive().max(100000),
    })
    .strict()
    .readonly(),
]);
export type SpecialWeaponDefinition = z.infer<typeof SpecialWeaponDefinitionSchema>;
export const SpecialEffectSlotsSchema = z.array(RuntimeEntityIdSchema.nullable()).max(100000).readonly();
/** Explicit source roster input: station holes are canonical lifecycle facts;
 * module-owned generation provenance determines any additional source slots. */
export interface SpecialEffectSlotsContext {
  readonly actorSpawnSlots: readonly (string | null)[];
  readonly stationSpawnSlots: readonly (string | null)[] | null;
  readonly actors: readonly Readonly<{ id: string; generation: NpcGeneration | null }>[];
}
