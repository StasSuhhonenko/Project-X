/** Focused, validated NPC rule inputs and outputs without runtime identity. */
import { z } from 'zod';
import { nextRandomUnit, UInt32Schema } from '../../random/seeded-random';
import {
  NpcMotionComponentSchema,
  PositionSchema,
  RotationDegreesSchema,
  RuntimeEntityIdSchema,
  type DurabilityComponent,
} from './entity-components';

/** Combined durability projection for navigation capabilities and decisions.
 * Module policy chooses its threshold; a zero maximum has no remaining share.
 * This metric is not a damage rule and never mutates condition. */
export function combinedDurabilityPercent(current: DurabilityComponent, maximum: DurabilityComponent): number {
  const total = maximum.hull + maximum.shields;
  if (total === 0) return 0;
  return ((current.hull + current.shields) / total) * 100;
}

/** A channel timer in fixed ticks. Null is never installed; `inert` is an
 * installed invalid/absent-weapon timer and is never ready or decremented.
 * Explicit finite representation avoids persisting NaN across JSON saves. */
export const NpcWeaponTimerSchema = z.union([z.number().int(), z.literal('inert')]).nullable();
export type NpcWeaponTimer = z.infer<typeof NpcWeaponTimerSchema>;

/** Saved per-actor decision history. Cursors count source slots (including holes),
 * timers count fixed simulation ticks and may pass below zero. Null means the
 * weapon has never installed a timer. Navigation alone owns target and offset. */
export const NpcCombatStateSchema = z
  .object({
    /** Sticky hit attribution; only hit settlement may latch this saved bit. */
    blameDeath: z.boolean(),
    /** Module-owned visual cloak; opacity is percent, in five-point steps. */
    cloaked: z.boolean(),
    opacity: z.number().int().min(0).max(100).multipleOf(5),
    /** Installed once by a decision; equipment definitions remain immutable. */
    fallbackPrimaryWeaponId: z.number().int().positive().nullable(),
    alert: z.enum(['peaceful', 'combat']),
    /** Persistent movement policy latch; navigation consumes, decisions own it. */
    strafing: z.boolean(),
    scanCursor: z.number().int().nonnegative(),
    rescueCursor: z.number().int().nonnegative(),
    primaryWeaponTimer: NpcWeaponTimerSchema,
    secondaryWeaponTimer: NpcWeaponTimerSchema,
    hail: z.enum(['none', 'pending', 'delivered']),
  })
  .strict()
  .readonly();
export type NpcCombatState = z.infer<typeof NpcCombatStateSchema>;

/** Sole fresh-state owner for authored, lifecycle and visit-generated ships.
 * Restore requires explicit saved state and must never invoke this factory. */
export function createNpcCombatState(): NpcCombatState {
  return NpcCombatStateSchema.parse({
    blameDeath: false,
    cloaked: false,
    opacity: 100,
    fallbackPrimaryWeaponId: null,
    alert: 'peaceful',
    strafing: false,
    scanCursor: 0,
    rescueCursor: 0,
    primaryWeaponTimer: null,
    secondaryWeaponTimer: null,
    hail: 'none',
  });
}

export const NpcTargetKindSchema = z.enum(['player-ship', 'planet', 'station', 'npc-ship']);

export const NpcTargetStateSchema = z
  .object({
    id: RuntimeEntityIdSchema,
    kind: NpcTargetKindSchema,
    position: PositionSchema,
  })
  .strict()
  .readonly();
export type NpcTargetState = z.infer<typeof NpcTargetStateSchema>;

/** One module-selected initial placement; the engine supplies entity identity. */
export const StartingNpcPlacementSchema = z
  .object({
    position: PositionSchema,
    targetEntityId: RuntimeEntityIdSchema,
    targetOffset: PositionSchema,
    randomState: UInt32Schema,
  })
  .strict()
  .readonly();
export type StartingNpcPlacement = z.infer<typeof StartingNpcPlacementSchema>;

/** Fields an NPC movement rule may update during one fixed simulation tick. */
export const NpcMovementStateSchema = z
  .object({
    position: PositionSchema,
    rotationDegrees: RotationDegreesSchema,
    motion: NpcMotionComponentSchema,
    targetOffset: PositionSchema,
  })
  .strict()
  .readonly();
export type NpcMovementState = z.infer<typeof NpcMovementStateSchema>;

export const NpcTickResultSchema = z
  .object({
    movement: NpcMovementStateSchema,
    randomState: UInt32Schema,
  })
  .strict()
  .readonly();
export type NpcTickResult = z.infer<typeof NpcTickResultSchema>;

/** Allocate a distinct uint32 actor stream without consuming visit draws.
 * XOR domain separation followed by the LCG's odd-multiplier permutation is
 * bijective on uint32 runtime sequences. IDs never recycle, including re-entry;
 * reject exhaustion rather than silently wrap/reuse an earlier actor stream.
 * Every NPC (authored, lifecycle-generated and visit encounter) navigates and,
 * from C10b, decides and fires with this stream; the world stream is never
 * threaded through per-actor behaviour. */
export function deriveNpcRandomState(sequence: number): number {
  z.number().int().positive().max(0xffffffff).parse(sequence);
  return nextRandomUnit((sequence ^ 0x4e504321) >>> 0).state;
}

export function freezeNpcTargetState(target: NpcTargetState): NpcTargetState {
  Object.freeze(target.position);
  return Object.freeze(target);
}

export function freezeNpcMovementState(state: NpcMovementState): NpcMovementState {
  Object.freeze(state.position);
  Object.freeze(state.motion);
  Object.freeze(state.targetOffset);
  return Object.freeze(state);
}
