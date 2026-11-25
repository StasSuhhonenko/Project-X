/** Focused module policy seams; shared simulation owns identity and publication. */
import { z } from 'zod';
import type { LifecycleDefinition } from '../../content/schemas/lifecycle-content';
import { UInt32Schema } from '../../random/seeded-random';
import { ConstructedStationIdSchema } from '../model/construction-state';
import {
  CommunicationIntentSchema,
  MAXIMUM_NOTICE_DELAY_TICKS,
  PositionSchema,
  RuntimeEntityIdSchema,
} from '../model/entity-components';
import {
  NpcGenerationSchema,
  StationMembershipSchema,
  SystemStandingSchema,
  SystemStrengthSchema,
  type NpcGeneration,
  type WorldLifecycle,
} from '../model/lifecycle-state';
import { ProgressionDeltaSchema } from '../model/progression-schema';

export interface StationHitContext {
  readonly attacker: Readonly<{ sizeClass: number }>;
  readonly weapon: Readonly<{ id: number; baseDamage: number }>;
  readonly target: Readonly<{ strength: number; maximumStrength: number }>;
}

/** Pure membership settlement only; no actor state, RNG or world mutation.
 * The engine supplies a deeply frozen projection. The record identifies one
 * distinct actor that was present at visit entry; a prior settlement may already
 * have changed its durable presence. Current durable membership is sparse and
 * canonical relative to authored defaults, never the active actor roster. */
export interface StationMembershipContext {
  readonly stationRecordId: string;
  readonly stationMembershipOverrides: WorldLifecycle['stationMembershipOverrides'];
}

/** Focused authored baseline and permission facts supplied by the engine.
 * Identity/default types come from the authoritative validated content schema;
 * mutable is derived once from its declared mutable-record capability. */
export type StationMembershipPolicyRecord = Readonly<
  Pick<LifecycleDefinition['stationRecords'][number], 'id' | 'initialPresence'> & { mutable: boolean }
>;

/** Attacker identity is hit-local, never saved as a second attribution owner. */
export const LifecycleHitAttackerSchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('player') })
    .strict()
    .readonly(),
  z
    .object({ kind: z.literal('npc'), id: RuntimeEntityIdSchema, sizeClass: z.number().finite().nonnegative() })
    .strict()
    .readonly(),
]);
export type LifecycleHitAttacker = z.infer<typeof LifecycleHitAttackerSchema>;

/** Durable identity has disjoint owners: authored membership settlement or the
 * construction record. Names and runtime entity IDs never alias either owner. */
export const LifecycleStationIdentitySchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('authored'), recordId: z.string().min(1) })
    .strict()
    .readonly(),
  z
    .object({ kind: z.literal('constructed'), stationId: ConstructedStationIdSchema })
    .strict()
    .readonly(),
]);
export type LifecycleStationIdentity = z.infer<typeof LifecycleStationIdentitySchema>;

export interface LifecycleHitContext {
  readonly attacker: LifecycleHitAttacker;
  readonly playerPosition: Readonly<{ x: number; y: number }>;
  readonly cameraZoom: number;
  readonly system: Readonly<{
    id: number;
    governmentId: number | null;
    opposingGovernmentId: number | null;
    initialStrength: number;
    strength: number | null;
  }>;
  readonly actor: Readonly<{
    id: string;
    kind: 'station' | 'npc-ship';
    definitionId: number;
    sizeClass: number;
    /** Null for ships; never a fabricated authored record for construction. */
    stationIdentity: LifecycleStationIdentity | null;
    generation: NpcGeneration | null;
    governmentId: number | null;
    targetsPlayer: boolean;
    remainingStrength: number;
    /** Historical station attribution; for ships this is derived from navigation. */
    playerAttributed: boolean;
    blameDeath: boolean;
  }>;
  /** Exact initialized declared scope, copied/frozen before policy execution. */
  readonly systemStanding: WorldLifecycle['systemStanding'];
  readonly stationMembershipOverrides: WorldLifecycle['stationMembershipOverrides'];
  /** Durable local construction census AFTER this hit: pending and complete
   * count, destroyed does not. A surviving hit does not subtract its actor. */
  readonly remainingConstructedStationCount: number;
  readonly stationSlots: readonly (string | null)[];
  readonly planetEntityId: string;
  readonly randomState: number;
}

export const GeneratedNpcSpawnSchema = z
  .object({
    definitionId: z.number().int().positive(),
    position: PositionSchema,
    rotationDegrees: z.number().finite(),
    targetEntityId: RuntimeEntityIdSchema.nullable(),
    governmentId: NpcGenerationSchema.unwrap().shape.governmentId,
    raceId: NpcGenerationSchema.unwrap().shape.raceId,
    name: NpcGenerationSchema.unwrap().shape.name,
  })
  .strict()
  .readonly();

/** Results are intent data. No module can assign runtime IDs or replace a world. */
export const LifecycleHitResultSchema = z
  .object({
    playerAttributed: z.boolean(),
    /** Tallies only: the captain stream and experience cannot be changed here. */
    tallyDelta: ProgressionDeltaSchema.unwrap().shape.tallies.optional(),
    blameDeath: z.boolean(),
    stationMembershipUpdates: z.array(StationMembershipSchema).readonly(),
    standingUpdates: z.array(SystemStandingSchema).readonly(),
    strengthUpdates: z.array(SystemStrengthSchema).readonly(),
    communication: CommunicationIntentSchema.nullable(),
    spawns: z.array(GeneratedNpcSpawnSchema).max(11).readonly(),
    notice: z
      .object({ code: z.string().regex(/^[a-z][a-z0-9-]*$/), message: z.string().min(1).max(160) })
      .strict()
      .readonly()
      .nullable(),
    /** Fixed ticks between the death and the notice reaching the player, so a
     * module can post it after its explosion artwork (absent: at once). The
     * death's outcomes always settle on the death tick. */
    noticeDelayTicks: z.number().int().nonnegative().max(MAXIMUM_NOTICE_DELAY_TICKS).optional(),
    randomState: UInt32Schema,
  })
  .strict()
  .readonly();
export type LifecycleHitResult = z.infer<typeof LifecycleHitResultSchema>;
