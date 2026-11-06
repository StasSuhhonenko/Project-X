/** Exact current-visit identity/slot proof, independent of current membership. */
import type { SystemDefinition } from '../../content/schemas/game-module';
import type { LifecycleDefinition } from '../../content/schemas/lifecycle-content';
import type { GameRules } from '../contracts/game-rules';
import { isStationPresent } from '../model/lifecycle-state';
import type { WorldState } from '../model/world-state';
import {
  equalStationMembership,
  resolveStationMembershipSettlement,
  validateStationMembershipState,
} from './station-membership';

/** Returns the only station placement IDs allowed to remain in this visit. */
export function validateActiveStationVisit(
  world: WorldState,
  system: SystemDefinition,
  definition: LifecycleDefinition | undefined,
  rules: GameRules
): readonly string[] {
  const state = world.lifecycle;
  validateStationMembershipState(state.stationMembershipOverrides, definition, rules);
  const records = definition?.stationRecords.filter(record => record.homeSystemId === system.id) ?? [];
  const visit = state.activeStationVisit;
  if (!records.length) {
    if (visit !== null || state.stationSpawnSlots !== null)
      throw new Error('Active system has no station visit capability.');
    return system.stations.map(station => station.id);
  }
  if (!visit || !definition) throw new Error('Active system is missing its station visit witness.');
  validateStationMembershipState(visit.entryMembershipOverrides, definition, rules);
  const entryRecords = system.stations.flatMap(station => {
    const record = records.find(candidate => candidate.stationPlacementId === station.id)!;
    return isStationPresent(record, { stationMembershipOverrides: visit.entryMembershipOverrides }) ? [record] : [];
  });
  const settled = visit.settledStationRecordIds;
  if (
    new Set(settled).size !== settled.length ||
    settled.some(
      id => !entryRecords.some(record => record.id === id) || !definition.mutableStationRecordIds.includes(id)
    )
  )
    throw new Error('Station visit settlement is duplicate, absent on entry or unsupported.');
  // Sequential policy evaluation is intentional: later settlements consume the
  // preceding durable state. No damage, random draw or generated actor replays.
  const replayed = settled.reduce(
    (membership, recordId) => resolveStationMembershipSettlement(recordId, membership, definition, rules).overrides,
    visit.entryMembershipOverrides
  );
  if (!equalStationMembership(replayed, state.stationMembershipOverrides))
    throw new Error('Station visit settlement witness disagrees with durable membership.');
  const planet = world.entities.find(entity => entity.kind === 'planet');
  if (!planet) throw new Error('Station visit requires its original planet allocation.');
  const planetSequence = Number(planet.id.slice('entity-'.length));
  const lastEntrySequence = planetSequence + entryRecords.length;
  if (!Number.isSafeInteger(lastEntrySequence) || world.nextEntitySequence <= lastEntrySequence)
    throw new Error('Allocator must exceed every historical station visit allocation.');
  const expected = entryRecords.map((record, index) => ({
    record,
    id: `entity-${planetSequence + index + 1}`,
    settled: settled.includes(record.id),
  }));
  const live = expected.filter(entry => !entry.settled);
  const stations = world.entities.filter(entity => entity.kind === 'station');
  if (
    stations.length !== live.length ||
    live.some(
      entry =>
        !stations.some(station => station.id === entry.id && station.stationId === entry.record.stationPlacementId)
    )
  )
    throw new Error('Active station actors disagree with the entered and settled visit roster.');
  const slots = [null, ...expected.map(entry => (entry.settled ? null : entry.id))];
  if (
    !state.stationSpawnSlots ||
    slots.length !== state.stationSpawnSlots.length ||
    slots.some((id, index) => state.stationSpawnSlots![index] !== id)
  )
    throw new Error('Station generation slots disagree with the exact visit roster.');
  // A removed entry actor's ID cannot be recycled into a different entity kind.
  if (expected.some(entry => entry.settled && world.entities.some(entity => entity.id === entry.id)))
    throw new Error('A settled station allocation cannot be reused.');
  return live.map(entry => entry.record.stationPlacementId);
}
