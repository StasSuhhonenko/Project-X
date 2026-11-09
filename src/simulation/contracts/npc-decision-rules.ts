/** One-actor combat policy seam. All positions/offsets are world units; timers
 * are fixed ticks, not milliseconds. Inputs are detached and deeply frozen.
 * Navigation is the only current target owner; writes are applied sequentially. */
import { z } from 'zod';
import type { WeaponDefinition } from '../../content/schemas/game-content';
import { UInt32Schema } from '../../random/seeded-random';
import {
  DurabilityComponentSchema,
  PlayerNoticeSchema,
  PositionSchema,
  RuntimeEntityIdSchema,
} from '../model/entity-components';
import { NpcCombatStateSchema } from '../model/npc-state';

export const NpcTargetResponseSchema = z
  .object({
    targetEntityId: RuntimeEntityIdSchema.nullable(),
    alert: NpcCombatStateSchema.unwrap().shape.alert,
  })
  .strict()
  .readonly();
export type NpcTargetResponse = z.infer<typeof NpcTargetResponseSchema>;

export const NpcDecisionSelfSchema = z
  .object({
    id: RuntimeEntityIdSchema,
    definitionId: z.number().int().positive(),
    kind: z.enum(['npc-ship', 'station']),
    strengthPercent: z.number().finite().min(0).max(100),
    governmentId: z.number().int().positive().nullable(),
    sizeClass: z.number().finite().nonnegative(),
    maximumHull: z.number().finite().nonnegative(),
    maximumShields: z.number().finite().nonnegative(),
    weaponDefinitionIds: z.array(z.number().int().positive().nullable()).readonly(),
    name: z.string(),
    position: PositionSchema,
    /** Emitter heading/speed for module-owned launch policy; stations have zero speed. */
    rotationDegrees: z.number().finite(),
    speedPerFrame: z.number().finite(),
    condition: DurabilityComponentSchema,
    engineDisabledFrames: z.number().int().nonnegative(),
    combat: NpcCombatStateSchema,
    targetEntityId: RuntimeEntityIdSchema.nullable(),
    targetOffset: PositionSchema,
    /** True when this actor demands goods currently carried by the player.
     * Policy owns the transition to pending and the one-time delivered notice. */
    hailEligible: z.boolean(),
    randomState: UInt32Schema,
  })
  .strict()
  .readonly();
export type NpcDecisionSelf = z.infer<typeof NpcDecisionSelfSchema>;

export const NpcDecisionSlotSchema = z
  .object({
    id: RuntimeEntityIdSchema,
    kind: z.enum(['npc-ship', 'station']),
    governmentId: z.number().int().positive().nullable(),
    position: PositionSchema,
    targetEntityId: RuntimeEntityIdSchema.nullable(),
    alert: NpcCombatStateSchema.unwrap().shape.alert.nullable(),
  })
  .strict()
  .readonly();
export type NpcDecisionSlot = z.infer<typeof NpcDecisionSlotSchema>;

export const NpcDecisionPlayerSchema = z
  .object({
    id: RuntimeEntityIdSchema,
    position: PositionSchema,
    cloaked: z.boolean(),
    condition: DurabilityComponentSchema,
  })
  .strict()
  .readonly();

export interface NpcDecisionContext {
  readonly self: NpcDecisionSelf;
  /** Source slot order, including slot zero and cleared holes. */
  readonly slots: readonly (NpcDecisionSlot | null)[];
  readonly player: z.infer<typeof NpcDecisionPlayerSchema>;
  readonly planetEntityId: string;
  readonly planetPosition: z.infer<typeof PositionSchema>;
  /** Actor-slot allocation cursor captured before visit encounters, including holes. */
  readonly entryActorSlotCount: number;
  readonly localGovernmentId: number | null;
  readonly opposingGovernmentId: number | null;
  /** Null when the selected module has no standing scope for this system. */
  readonly localStanding: number | null;
  readonly cameraZoom: number;
  readonly slotCount: number;
  getWeaponDefinition(id: number): WeaponDefinition | undefined;
}

export const NpcDecisionSchema = z
  .object({
    combat: NpcCombatStateSchema,
    targetEntityId: RuntimeEntityIdSchema.nullable(),
    targetOffset: PositionSchema,
    randomState: UInt32Schema,
    actorWrites: z
      .array(NpcTargetResponseSchema.unwrap().extend({ actorId: RuntimeEntityIdSchema }).strict().readonly())
      .max(100000)
      .readonly(),
    /** Weapon and target only: the module hit rule (`resolvePrimaryHit`) is the
     * sole owner of damage arithmetic, so no power is carried or rechecked. */
    beamShots: z
      .array(
        z
          .object({
            weaponDefinitionId: z.number().int().positive(),
            targetEntityId: RuntimeEntityIdSchema,
          })
          .strict()
          .readonly()
      )
      .max(1024)
      .readonly(),
    projectileShots: z
      .array(
        z
          .object({
            weaponDefinitionId: z.number().int().positive(),
            targetEntityId: RuntimeEntityIdSchema,
            rotationDegrees: z.number().finite(),
            launchSpeedPerFrame: z.number().finite().nonnegative(),
          })
          .strict()
          .readonly()
      )
      .max(1024)
      .readonly(),
    /** Complete all emissions and writes before leaving, without death effects. */
    departure: PlayerNoticeSchema.unwrap().omit({ sequence: true }).strict().readonly().nullable(),
    notice: PlayerNoticeSchema.unwrap().omit({ sequence: true }).strict().readonly().nullable(),
  })
  .strict()
  .readonly();
export type NpcDecision = z.infer<typeof NpcDecisionSchema>;

/** Accepted emission hook, once per new channel sequence, including projectiles
 * and targeted devices. Delayed impact must not replay the emission response. */
export const NpcPlayerShotContextSchema = z
  .object({
    actor: NpcDecisionSelfSchema.unwrap()
      .pick({ id: true, governmentId: true, combat: true, targetEntityId: true })
      .readonly(),
    playerEntityId: RuntimeEntityIdSchema,
    weaponDefinitionId: z.number().int().positive(),
  })
  .strict()
  .readonly();
export type NpcPlayerShotContext = z.infer<typeof NpcPlayerShotContextSchema>;

/** Last tick's captured beam presentation events. Historical IDs may cease to
 * resolve; snapshots let a renderer retain lethal/orphan beams without rules.
 * Replaced at the next NPC phase, saved with the completed world, never replayed
 * as damage on restore. Multiple emitters can fire during one tick. */
export const NpcBeamEventSchema = z
  .object({
    tick: z.number().int().nonnegative(),
    emitterEntityId: RuntimeEntityIdSchema,
    targetEntityId: RuntimeEntityIdSchema,
    weaponDefinitionId: z.number().int().positive(),
    origin: PositionSchema,
    targetPosition: PositionSchema,
  })
  .strict()
  .readonly();

/** Bounded presentation history for one completed tick; shared by restore and emission. */
export const NpcBeamEventsSchema = z.array(NpcBeamEventSchema).max(100000).readonly();
