/** Reviewed immutable source facts consumed by the bounded station lifecycle.
 * The full census is deliberately module-owned: it grants no world/media access.
 * No generated ActionScript or recovery tool enters the runtime dependency graph.
 */
import { z } from 'zod';
import { SystemStandingSchema } from '../../src/simulation/model/lifecycle-state';
import data from './lifecycle-data.json';
import ordinaryData from './ordinary-lifecycle-data.json';

const positiveId = z.number().int().positive();
export const StationCensusRowSchema = z.strictObject({
  id: z.string().regex(/^bm1-station-record-\d{3}$/),
  sourceRecordNumber: positiveId.max(166), homeSystemId: positiveId.max(52),
  initiallyPresent: z.boolean(), sourceState: z.number().int(),
  structureDefinitionId: positiveId, aliasGroup: z.string().min(1),
});
export type StationCensusRow = z.infer<typeof StationCensusRowSchema>;
const point = z.strictObject({x: z.number().finite(), y: z.number().finite()});
export const LifecycleMetadataSchema = z.strictObject({
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  stations: z.array(StationCensusRowSchema).length(166),
  governments: z.array(z.strictObject({systemId: positiveId.max(52),
    governmentId: z.number().int().nonnegative(), opposingGovernmentId: positiveId.nullable(),
    initialStrength: z.number().finite().nonnegative()})).length(52),
  names: z.array(z.string().min(1)).length(219),
  starts: z.array(z.strictObject({startId: z.string().min(1), systemStandingDefaults: z.array(SystemStandingSchema).length(9),
    source: z.string(), sourceSha256: z.string().regex(/^[a-f0-9]{64}$/)})).length(12),
  defenderRoster: z.tuple([z.literal(25),z.literal(26),z.literal(59)]), defenderRaceId: z.literal(6),
  earthDefenderRoster: z.tuple([z.literal(33),z.literal(34),z.literal(35),z.literal(36),z.literal(37),z.literal(38),z.literal(6)]),
  earthDefenderRaceId:z.literal(2),
  frames: z.array(z.strictObject({frame: positiveId, offset: positiveId, mediaId: positiveId,
    rawMatrix: z.array(z.number().int()).length(6), file: z.string(), sha256: z.string(),
    nativeSize: z.strictObject({width: positiveId, height: positiveId}), pivot: point,
    scale: z.number().finite().positive()})).length(5),
}).superRefine((facts, context) => {
  const issue = (message: string) => context.addIssue({code:'custom', message});
  facts.stations.forEach((row, index) => {
    if (row.sourceRecordNumber !== index + 1 || row.id !== `bm1-station-record-${String(index+1).padStart(3,'0')}`) issue('Station census order/identity differs.');
  });
  facts.governments.forEach((row, index) => {if (row.systemId !== index+1) issue('Government census order/identity differs.');});
  if (new Set(facts.starts.map(start => start.startId)).size !== 12) issue('Duplicate start standing defaults.');
  facts.starts.forEach(start => {
    if (start.systemStandingDefaults.map(entry => entry.systemId).join(',') !== '1,2,3,4,5,7,8,9,12') issue('Consumed start standing scope differs.');
  });
  if (facts.governments.filter(row => row.governmentId === 5).map(row => row.systemId).join(',') !== '12') issue('Vulcan government scope differs.');
  if (facts.stations.filter(row => row.aliasGroup === 'U of Vulcan').length !== 1) issue('Supported station must have a unique alias.');
  if (facts.stations.filter(row => row.aliasGroup === 'PS-102').map(row => row.sourceRecordNumber).join(',') !== '12,14') issue('Reviewed PS-102 alias census differs.');
});

/** Freeze nested metadata once at import, never expose a writable source array. */
type DeepReadonly<T> = T extends object ? {readonly [K in keyof T]: DeepReadonly<T[K]>} : T;
function freezeFacts<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(child => freezeFacts(child));
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}
export const lifecycleMetadata = freezeFacts(LifecycleMetadataSchema.parse(data));
/** Complete consumed ordinary projection. Earlier partial metadata remains
 * preserved evidence; these defaults have one current runtime owner. System52
 * is deliberately absent: several original starts do not initialize its value. */
export const OrdinaryLifecycleMetadataSchema = z.strictObject({
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  ordinarySystemIds: z.array(positiveId.max(51)).length(43),
  excludedSystems: z.array(z.strictObject({systemId:positiveId.max(52), reasons:z.array(z.string().min(1)).min(1)})).length(9),
  mutableStationRecordIds: z.array(StationCensusRowSchema.shape.id).length(159),
  strengthSystemIds: z.array(positiveId.max(51)).length(32),
  governmentProfiles: z.array(z.strictObject({
    governmentId:positiveId, raceId:positiveId, roster:z.array(positiveId.max(69)).min(1),
    namePrefix:z.string(), standingFanoutSystemIds:z.array(positiveId.max(51)),
  })).length(11),
  systemStandingIds:z.array(positiveId.max(51)).length(51),
  starts: z.array(z.strictObject({
    startId: z.string().min(1), sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    systemStandingDefaults: z.array(SystemStandingSchema).length(51),
  })).length(12),
}).superRefine((facts, context) => {
  const issue = (message: string) => context.addIssue({ code: 'custom', message });
  const equalIds = (actual:readonly (number|string)[], expected:readonly (number|string)[]) => actual.join(',') === expected.join(',');
  if (facts.sourceSha256 !== lifecycleMetadata.sourceSha256) issue('Ordinary source identity differs.');
  const partition = [...facts.ordinarySystemIds, ...facts.excludedSystems.map(row => row.systemId)].sort((a,b)=>a-b);
  if (!equalIds(partition,lifecycleMetadata.governments.map(row=>row.systemId))) issue('Ordinary and excluded systems must partition the full census.');
  const selected = lifecycleMetadata.stations.filter(row => facts.ordinarySystemIds.includes(row.homeSystemId));
  if (!equalIds(facts.mutableStationRecordIds,selected.map(row=>row.id))) issue('Mutable records differ from the reviewed ordinary census.');
  const homes = [...new Set(selected.map(row=>row.homeSystemId))].sort((a,b)=>a-b);
  if (!equalIds(facts.strengthSystemIds,homes)) issue('Consumed strength must cover exactly the ordinary station homes.');
  const governments = [...new Set(homes.map(id=>lifecycleMetadata.governments[id-1]!.governmentId))].sort((a,b)=>a-b);
  if (!equalIds(facts.governmentProfiles.map(row=>row.governmentId),governments)) issue('Generated profiles must cover exactly the consumed governments.');
  facts.governmentProfiles.forEach(profile => {
    const fanout = profile.governmentId === 12 ? [] : lifecycleMetadata.governments
      .filter(row=>row.governmentId===profile.governmentId).map(row=>row.systemId);
    if (!equalIds(profile.standingFanoutSystemIds,fanout)) issue('Government fan-out differs from the full source census.');
    if (new Set(profile.roster).size !== profile.roster.length) issue('Duplicate generated roster identity.');
  });
  if (!equalIds(facts.systemStandingIds,Array.from({length:51},(_,index)=>index+1))) issue('Consumed standing scope differs.');
  if (new Set(facts.starts.map(start=>start.startId)).size !== lifecycleMetadata.starts.length) issue('Each reviewed start is required exactly once.');
  facts.starts.forEach(start => {
    const prior = lifecycleMetadata.starts.find(row => row.startId === start.startId);
    if (!prior || prior.sourceSha256 !== start.sourceSha256
      || !equalIds(start.systemStandingDefaults.map(entry=>entry.systemId),facts.systemStandingIds))
      issue('Start standing identity or consumed scope differs.');
    if (prior && !prior.systemStandingDefaults.every(entry=>start.systemStandingDefaults
      .some(candidate=>candidate.systemId===entry.systemId && candidate.value===entry.value)))
      issue('Earlier consumed source defaults must remain unchanged.');
  });
});
export const ordinaryLifecycleMetadata = freezeFacts(OrdinaryLifecycleMetadataSchema.parse(ordinaryData));
export const LIFECYCLE_SYSTEM_IDS = ordinaryLifecycleMetadata.ordinarySystemIds;
export const STRENGTH_SYSTEM_IDS = ordinaryLifecycleMetadata.strengthSystemIds;
export const STANDING_SYSTEM_IDS = ordinaryLifecycleMetadata.systemStandingIds;
export const MUTABLE_STATION_RECORD_IDS = ordinaryLifecycleMetadata.mutableStationRecordIds;
export const VULCAN_STATION_RECORD_ID = 'bm1-station-record-055';
/** Exact globally unique five-record scope reviewed by C2d. */
export const VULCAN_STATION_RECORD_IDS: readonly string[] = Object.freeze([55,56,57,58,59].map(id =>
  `bm1-station-record-${String(id).padStart(3,'0')}`));
/** Local projection for Earth tests/consumers; labels never identify actors. */
export const EARTH_MUTABLE_STATION_RECORD_IDS: readonly string[] = Object.freeze(lifecycleMetadata.stations
  .filter(row => row.homeSystemId === 1 && MUTABLE_STATION_RECORD_IDS.includes(row.id)).map(row => row.id));

/** The one immutable consumed default collection per supported start. */
export function standingDefaults(startId: string) {
  const start = ordinaryLifecycleMetadata.starts.find(start => start.startId === startId);
  if (!start) throw new Error('No reviewed standing defaults for '+startId);
  return start.systemStandingDefaults;
}
