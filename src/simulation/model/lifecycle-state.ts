/** Serializable, game-neutral station presence, standing and active actor facts. */
import { z } from 'zod';
import { RuntimeEntityIdSchema, SystemIdSchema } from './entity-components';

export const LifecycleRecordIdSchema = z.string().regex(/^[a-z][a-z0-9-]*$/);
export const SystemStandingSchema = z.object({
  systemId: SystemIdSchema,
  value: z.number().finite(),
}).strict().readonly();
/** Signed current strength shares the scoped finite scalar contract with standing. */
export const SystemStrengthSchema = SystemStandingSchema;
export type SystemStanding = z.infer<typeof SystemStandingSchema>;

/** Exact scope identity for already Zod-validated standing entries. Standing may
 * refer to an unimplemented spatial system; declaring it never creates a route.
 * Starts, hit preparation and restore reuse this key-set invariant rather than
 * silently adding absent defaults or discarding foreign entries. */
export function hasExactStandingScope(entries: readonly SystemStanding[], scopeIds: readonly number[]): boolean {
  const declared = new Set(scopeIds);
  if (declared.size !== scopeIds.length || entries.length !== declared.size) return false;
  return new Set(entries.map(entry => entry.systemId)).size === entries.length
    && entries.every(entry => declared.has(entry.systemId));
}

export const StationMembershipSchema = z.object({
  stationRecordId: LifecycleRecordIdSchema,
  present: z.boolean(),
}).strict().readonly();
export type StationMembership = z.infer<typeof StationMembershipSchema>;

/** Historical entry facts, not another writable current-membership owner. */
export const ActiveStationVisitSchema = z.object({
  entryMembershipOverrides: z.array(StationMembershipSchema).readonly(),
  /** Actor identity is its unique authored record within this one visit. */
  settledStationRecordIds: z.array(LifecycleRecordIdSchema).readonly(),
}).strict().superRefine((visit, context) => {
  if (new Set(visit.settledStationRecordIds).size !== visit.settledStationRecordIds.length)
    context.addIssue({ code: 'custom', message: 'A station can settle only once per visit.' });
}).readonly();

/** Active scalar damage is intentionally distinct from persistent presence. */
export const StationCombatSchema = z.object({
  recordId: LifecycleRecordIdSchema,
  strength: z.number().finite().positive(),
  maximumStrength: z.number().finite().positive(),
  playerAttributed: z.boolean(),
  blameDeath: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.strength > value.maximumStrength) context.addIssue({
    code: 'custom', path: ['strength'], message: 'Station strength exceeds its maximum.',
  });
}).readonly();

/** Provenance of a policy-generated actor, never inferred from its display name. */
export const NpcGenerationSchema = z.object({
  policyId: LifecycleRecordIdSchema,
  governmentId: z.number().int().positive(),
  raceId: z.number().int().positive(),
  name: z.string().min(1).max(256),
  playerAttributed: z.boolean(),
  blameDeath: z.boolean(),
}).strict().readonly();
export type NpcGeneration = z.infer<typeof NpcGenerationSchema>;

export const WorldLifecycleSchema = z.object({
  /** Immutable provenance binds consumed start defaults to the save's start ID. */
  standingStartId: LifecycleRecordIdSchema.nullable(),
  stationMembershipOverrides: z.array(StationMembershipSchema).readonly(),
  /** Only consumed standing entries exist; each is initialized once at start. */
  systemStanding: z.array(SystemStandingSchema).readonly(),
  /** Declared consumed system strengths, initialized once from selected content. */
  systemStrength: z.array(SystemStrengthSchema).readonly(),
  /** Active generation target roster; null means this scene has no such policy. */
  stationSpawnSlots: z.array(RuntimeEntityIdSchema.nullable()).readonly().nullable(),
  activeStationVisit: ActiveStationVisitSchema.nullable(),
}).strict().superRefine((value, context) => {
  if (new Set(value.stationMembershipOverrides.map(entry => entry.stationRecordId)).size
      !== value.stationMembershipOverrides.length) context.addIssue({ code: 'custom', message: 'Duplicate station membership.' });
  if (new Set(value.systemStrength.map(entry => entry.systemId)).size !== value.systemStrength.length)
    context.addIssue({ code: 'custom', message: 'Duplicate system strength.' });
  if (new Set(value.systemStanding.map(entry => entry.systemId)).size !== value.systemStanding.length)
    context.addIssue({ code: 'custom', message: 'Duplicate system standing.' });
}).readonly();
export type WorldLifecycle = z.infer<typeof WorldLifecycleSchema>;

/** Fresh empty value per session; no mutable singleton can escape into a store. */
export function createEmptyLifecycle(): WorldLifecycle {
  return WorldLifecycleSchema.parse({ standingStartId: null, stationMembershipOverrides: [], systemStanding: [], systemStrength: [], stationSpawnSlots: null, activeStationVisit: null });
}

/** One canonical effective-presence rule, shared by entry and restore boundaries. */
export function isStationPresent(record: Readonly<{ id: string; initialPresence: boolean }>,
  state: Pick<WorldLifecycle, 'stationMembershipOverrides'>): boolean {
  return state.stationMembershipOverrides.find(entry => entry.stationRecordId === record.id)?.present ?? record.initialPresence;
}

/**
 * A visit captures an ordered subset of authored stations with a leading empty
 * slot. A surviving station must occur once; a hole can represent only an absent
 * station chosen on entry. This structural check retains possible source-order
 * alignments without enumerating every subset. The content-aware active-visit
 * validator additionally proves the one exact entry roster and its slot holes.
 */
export function isValidStationSpawnSlots(slots: readonly (string | null)[] | null,
  orderedStationIds: readonly string[], liveStations: readonly Readonly<{stationId:string; id:string}>[]): boolean {
  if (!slots || slots[0] !== null || slots.length > orderedStationIds.length + 1) return false;
  if (new Set(orderedStationIds).size !== orderedStationIds.length
      || new Set(liveStations.map(station => station.stationId)).size !== liveStations.length
      || liveStations.some(station => !orderedStationIds.includes(station.stationId))) return false;
  const consumed = orderedStationIds.reduce((positions, stationId) => {
    const live = liveStations.find(station => station.stationId === stationId);
    return new Set([...positions].flatMap(position => {
      const include = position < slots.length && slots[position] === (live?.id ?? null) ? [position + 1] : [];
      return live ? include : [position, ...include];
    }));
  }, new Set([1]));
  return consumed.has(slots.length);
}
