/** Focused module policy seams; shared simulation owns identity and publication. */
import { z } from 'zod';
import type { LifecycleDefinition } from '../../content/schemas/lifecycle-content';
import { UInt32Schema } from '../../random/seeded-random';
import { CommunicationIntentSchema, PositionSchema, RuntimeEntityIdSchema } from '../model/entity-components';
import { NpcGenerationSchema, StationMembershipSchema, SystemStandingSchema, SystemStrengthSchema,
  type NpcGeneration, type WorldLifecycle } from '../model/lifecycle-state';

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

export interface LifecycleHitContext {
  readonly playerPosition: Readonly<{ x: number; y: number }>;
  readonly cameraZoom: number;
  readonly system: Readonly<{ id: number; governmentId: number; opposingGovernmentId: number | null; initialStrength: number; strength: number | null }>;
  readonly actor: Readonly<{
    id: string; kind: 'station' | 'npc-ship'; definitionId: number; sizeClass: number;
    stationRecordId: string | null; generation: NpcGeneration | null;
    remainingStrength: number; playerAttributed: boolean; blameDeath: boolean;
  }>;
  /** Exact initialized declared scope, copied/frozen before policy execution. */
  readonly systemStanding: WorldLifecycle['systemStanding'];
  readonly stationMembershipOverrides: WorldLifecycle['stationMembershipOverrides'];
  readonly stationSlots: readonly (string | null)[];
  readonly planetEntityId: string;
  readonly randomState: number;
}

export const GeneratedNpcSpawnSchema = z.object({
  definitionId: z.number().int().positive(),
  position: PositionSchema,
  rotationDegrees: z.number().finite(),
  targetEntityId: RuntimeEntityIdSchema.nullable(),
  governmentId: NpcGenerationSchema.unwrap().shape.governmentId,
  raceId: NpcGenerationSchema.unwrap().shape.raceId,
  name: NpcGenerationSchema.unwrap().shape.name,
}).strict().readonly();

/** Results are intent data. No module can assign runtime IDs or replace a world. */
export const LifecycleHitResultSchema = z.object({
  playerAttributed: z.boolean(),
  blameDeath: z.boolean(),
  stationMembershipUpdates: z.array(StationMembershipSchema).readonly(),
  standingUpdates: z.array(SystemStandingSchema).readonly(),
  strengthUpdates: z.array(SystemStrengthSchema).readonly(),
  communication: CommunicationIntentSchema.nullable(),
  spawns: z.array(GeneratedNpcSpawnSchema).max(11).readonly(),
  notice: z.object({ code: z.string().regex(/^[a-z][a-z0-9-]*$/), message: z.string().min(1).max(160) }).strict().readonly().nullable(),
  randomState: UInt32Schema,
}).strict().readonly();
export type LifecycleHitResult = z.infer<typeof LifecycleHitResultSchema>;
