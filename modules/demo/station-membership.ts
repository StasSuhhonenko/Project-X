/** Authored survey membership policy, independent of labels and actor identity.
 * The two Weft platforms share a reversible archival lease; the existing Lumen
 * records retain their separate singleton retirement behavior. Definitions own
 * defaults, while these pure callbacks own the lease rule and save reachability.
 */
import type {
  StationMembershipContext,
  StationMembershipPolicyRecord,
} from '@engine/simulation/contracts/lifecycle-rules';
import type { StationMembership } from '@engine/simulation/model/lifecycle-state';
import definition from './public/game/module.json';

const pairedRecords = ['weft-north-record', 'weft-south-record'];
const records = definition.lifecycle.stationRecords;
const present = (id: string, overrides: readonly StationMembership[]) =>
  overrides.find(entry => entry.stationRecordId === id)?.present ??
  records.find(record => record.id === id)!.initialPresence;

/** Reject alternate defaults/capabilities before interpreting a sparse save.
 * The host always supplies the actual content projection. Direct policy calls
 * use the same authored baseline held privately by this module. */
export function validateStationMembership(
  overrides: readonly StationMembership[],
  authoredRecords?: readonly StationMembershipPolicyRecord[]
): boolean {
  if (
    authoredRecords &&
    (authoredRecords.length !== records.length ||
      !records.every(record => {
        const authored = authoredRecords.find(candidate => candidate.id === record.id);
        return (
          authored?.initialPresence === record.initialPresence &&
          authored.mutable === definition.lifecycle.mutableStationRecordIds.includes(record.id)
        );
      }))
  )
    return false;
  if (new Set(overrides.map(entry => entry.stationRecordId)).size !== overrides.length) return false;
  if (
    !overrides.every(entry => {
      const record = records.find(record => record.id === entry.stationRecordId);
      return record && entry.present !== record.initialPresence;
    })
  )
    return false;
  return pairedRecords.every(id => present(id, overrides) === present(pairedRecords[0]!, overrides));
}

export function resolveStationMembership(context: StationMembershipContext): readonly StationMembership[] {
  if (
    !validateStationMembership(context.stationMembershipOverrides) ||
    !records.some(record => record.id === context.stationRecordId)
  )
    throw new Error('Invalid survey membership.');
  const affected = pairedRecords.includes(context.stationRecordId) ? pairedRecords : [context.stationRecordId];
  return affected.map(stationRecordId => ({
    stationRecordId,
    present: !present(stationRecordId, context.stationMembershipOverrides),
  }));
}
