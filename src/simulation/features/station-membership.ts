/** Content-aware membership validation shared by activation, settlement and restore. */
import { z } from 'zod';
import type { LifecycleDefinition } from '../../content/schemas/lifecycle-content';
import type { GameRules } from '../contracts/game-rules';
import { StationMembershipSchema, type StationMembership } from '../model/lifecycle-state';

export function equalStationMembership(
  left: readonly StationMembership[],
  right: readonly StationMembership[]
): boolean {
  return (
    left.length === right.length &&
    left.every(entry =>
      right.some(
        candidate => candidate.stationRecordId === entry.stationRecordId && candidate.present === entry.present
      )
    )
  );
}

/** Sparse overrides contain only changed, declared mutable records, once each. */
export function validateStationMembershipState(
  overrides: readonly StationMembership[],
  definition: LifecycleDefinition | undefined,
  rules: GameRules
): void {
  if (
    new Set(overrides.map(entry => entry.stationRecordId)).size !== overrides.length ||
    overrides.some(entry => {
      const record = definition?.stationRecords.find(candidate => candidate.id === entry.stationRecordId);
      return (
        !record || !definition?.mutableStationRecordIds.includes(record.id) || record.initialPresence === entry.present
      );
    })
  )
    throw new Error('Station membership is unknown, unsupported, duplicate or redundant.');
  if (!definition) return;
  // A fresh frozen projection prevents a policy from acquiring mutable aliases.
  const projection = Object.freeze(overrides.map(entry => Object.freeze({ ...entry })));
  const records = Object.freeze(
    definition.stationRecords.map(record =>
      Object.freeze({
        id: record.id,
        initialPresence: record.initialPresence,
        mutable: definition.mutableStationRecordIds.includes(record.id),
      })
    )
  );
  if (!rules.validateStationMembership || rules.validateStationMembership(projection, records) !== true)
    throw new Error('Station membership violates the selected module policy.');
}

/**
 * Evaluate one distinct station settlement without touching active actors. The
 * module may update other declared records or restore a default. Canonicalizing
 * here keeps current saves sparse and gives restore the identical operation.
 */
export function resolveStationMembershipSettlement(
  stationRecordId: string,
  overrides: readonly StationMembership[],
  definition: LifecycleDefinition,
  rules: GameRules
): {
  readonly updates: readonly StationMembership[];
  readonly overrides: readonly StationMembership[];
} {
  validateStationMembershipState(overrides, definition, rules);
  if (!definition.mutableStationRecordIds.includes(stationRecordId) || !rules.resolveStationMembership)
    throw new Error('Station membership settlement capability is unavailable.');
  const updates = z.array(StationMembershipSchema).parse(
    rules.resolveStationMembership(
      Object.freeze({
        stationRecordId,
        stationMembershipOverrides: Object.freeze(overrides.map(entry => Object.freeze({ ...entry }))),
      })
    )
  );
  if (
    new Set(updates.map(entry => entry.stationRecordId)).size !== updates.length ||
    updates.some(entry => !definition.mutableStationRecordIds.includes(entry.stationRecordId))
  )
    throw new Error('Station membership settlement references a duplicate or unavailable record.');
  const merged = [
    ...overrides.filter(entry => !updates.some(update => update.stationRecordId === entry.stationRecordId)),
    ...updates,
  ].filter(
    entry =>
      definition.stationRecords.find(record => record.id === entry.stationRecordId)!.initialPresence !== entry.present
  );
  validateStationMembershipState(merged, definition, rules);
  return { updates: Object.freeze(updates), overrides: Object.freeze(merged) };
}
