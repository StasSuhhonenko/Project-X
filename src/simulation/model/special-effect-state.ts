/** Saved authoritative effects; presentation derives geometry from these facts. */
import { z } from 'zod';
import { PulsePolicySchema, SpecialWeaponDefinitionSchema } from '../contracts/special-weapon-rules';
import { PositionSchema, PositiveDefinitionIdSchema, RuntimeEntityIdSchema, SystemIdSchema } from './entity-components';

export const ActorSpecialStatusSchema = z.object({
  /** Authoritative toggle/reveal state; opacity interpolation is presentation. */
  cloaked: z.boolean().default(false),
  /** A legacy hit intent is distinct from damage strength. The supported cloud
   * supplies no new strength, so this flag alone never reduces durability. */
  hitFlag: z.number().int().nonnegative().max(100000).default(0),
  /** Remaining skipped movement ticks; heading and stored speed are retained. */
  engineDisabledFrames: z.number().int().nonnegative().max(100000).default(0),
}).strict().readonly().default({ cloaked: false, engineDisabledFrames: 0, hitFlag: 0 });
export type ActorSpecialStatus = z.infer<typeof ActorSpecialStatusSchema>;
/** A scan span changes only when the canonical actor roster grows. Its
 * first lead is saved so restore can reproduce the exact cursor after wraps. */
export const PulseScanSegmentSchema = z.object({
  firstAgeTick: z.number().int().positive().max(100000),
  slotCount: z.number().int().nonnegative().max(100000),
}).strict().readonly();
export type PulseScanSegment = z.infer<typeof PulseScanSegmentSchema>;
const common = {
  id: RuntimeEntityIdSchema, emitterEntityId: RuntimeEntityIdSchema,
  emitterDefinitionId: PositiveDefinitionIdSchema, weaponDefinitionId: PositiveDefinitionIdSchema,
  systemId: SystemIdSchema, origin: PositionSchema,
  spawnedTick: z.number().int().nonnegative().safe(), ageTicks: z.number().int().nonnegative().safe(),
  effectDefinitionId: z.string().min(1),
};
export const SpecialEffectStateSchema = z.discriminatedUnion('kind', [
  z.object({ ...common, kind: z.literal('pulse'), policy: PulsePolicySchema,
    cursor: z.number().int().nonnegative().max(10000000).nullable(),
    scanSegments: z.array(PulseScanSegmentSchema).max(100000).readonly().default([]),
    scalePercent: z.number().finite().nonnegative().max(100000000),
    alphaPercent: z.number().finite().min(0).max(100),
  }).strict().readonly(),
  z.object({ ...common, kind: z.literal('tractor'), targetEntityId: RuntimeEntityIdSchema,
    policy: SpecialWeaponDefinitionSchema.options[3],
  }).strict().readonly(),
]);
export type SpecialEffectState = z.infer<typeof SpecialEffectStateSchema>;
