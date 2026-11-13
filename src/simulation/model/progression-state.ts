/** Captain-owned progression, independent of the current vessel.
 * Values use module-defined units; content owns all labels and thresholds. */
import { z } from 'zod';
import { UInt32Schema } from '../../random/seeded-random';
import {
  ProgressionDefinitionSchema,
  ProgressionDeltaSchema,
  ProgressionStateSchema,
  type ProgressionDefinition,
  type ProgressionDelta,
  type ProgressionState,
} from './progression-schema';
import { parseWorldState, type WorldState } from './world-schema';

export * from './progression-schema';

/** Sparse operations may address only existing, exact-content-validated keys. */
function assertDeclaredProgressionIds(
  values: Readonly<Record<string, number>>,
  state: Readonly<Record<string, number>>
): void {
  if (Object.keys(values).some(id => !Object.hasOwn(state, id))) throw new Error('Undeclared progression ID.');
}

/** Single exact-scope assertion for construction, operations and restore.
 * Null is required exactly when progression content is absent. */
export function validateProgressionState(state: ProgressionState | null, content?: ProgressionDefinition): void {
  if (!content) {
    if (state !== null) throw new Error('Progression requires declared content.');
    return;
  }
  if (state === null) throw new Error('Declared progression state is missing.');
  const parsed = ProgressionStateSchema.parse(state);
  const exact = (values: Readonly<Record<string, number>>, ids: readonly { readonly id: string }[]) =>
    Object.keys(values).length === ids.length && ids.every(item => Object.hasOwn(values, item.id));
  if (!exact(parsed.experience, content.skills) || !exact(parsed.tallies, content.tallies))
    throw new Error('Progression keys must exactly match declared content.');
}

/** XOR the initial world seed with 0x9e3779b9 (golden-ratio mixing constant)
 * for deterministic domain separation. This draws nothing from the world/NPC
 * stream and never changes its state or existing deterministic evidence. */
export function createProgressionState(
  content: ProgressionDefinition | undefined,
  seed: number
): ProgressionState | null {
  if (!content) return null;
  const definition = ProgressionDefinitionSchema.parse(content);
  const state = ProgressionStateSchema.parse({
    experience: Object.fromEntries(definition.skills.map(item => [item.id, 0])),
    tallies: Object.fromEntries(definition.tallies.map(item => [item.id, 0])),
    randomState: (UInt32Schema.parse(seed) ^ 0x9e3779b9) >>> 0,
  });
  validateProgressionState(state, definition);
  return state;
}

/** Validate the entire additive operation before returning one parsed world.
 * Invalid IDs, increments and overflow throw without changing the input. */
export function applyProgressionDelta(
  world: WorldState,
  input: ProgressionDelta,
  content?: ProgressionDefinition
): WorldState {
  validateProgressionState(world.progression, content);
  const delta = ProgressionDeltaSchema.parse(input);
  const keys = ['experience', 'tallies'] as const;
  if (keys.every(key => Object.keys(delta[key]).length === 0)) return world;
  const state = world.progression;
  if (!state) throw new Error('Cannot increment absent progression.');
  const add = (key: (typeof keys)[number]) => {
    assertDeclaredProgressionIds(delta[key], state[key]);
    return Object.fromEntries(Object.entries(state[key]).map(([id, value]) => [id, value + (delta[key][id] ?? 0)]));
  };
  return parseWorldState({
    ...world,
    progression: { ...state, experience: add('experience'), tallies: add('tallies') },
  });
}

/** Assign sparse experience values in absolute module-defined units, including
 * lowering existing values. Ordinary awards continue to use monotone deltas.
 * The same exact content scope and declared-ID checks apply to both operations.
 * Empty assignments preserve identity. Non-finite/negative values and absent
 * progression refuse by throwing before any input mutation; tallies and every
 * random stream are preserved. One final world parse enforces state invariants. */
export function applyProgressionAssignment(
  world: WorldState,
  values: Readonly<Record<string, number>>,
  content?: ProgressionDefinition
): WorldState {
  validateProgressionState(world.progression, content);
  const parsed = z.record(z.string(), z.number().finite()).parse(values);
  if (Object.keys(parsed).length === 0) return world;
  const state = world.progression;
  if (!state) throw new Error('Cannot assign absent progression.');
  assertDeclaredProgressionIds(parsed, state.experience);
  return parseWorldState({
    ...world,
    progression: { ...state, experience: { ...state.experience, ...parsed } },
  });
}

/** Frozen views for policies and presentation consumers; no mutable copies leak. */
export function selectProgression(world: WorldState): ProgressionState | null {
  return world.progression;
}
export function selectExperience(world: WorldState, id: string): number | undefined {
  return world.progression?.experience[id];
}
export function selectProgressionTally(world: WorldState, id: string): number | undefined {
  return world.progression?.tallies[id];
}
