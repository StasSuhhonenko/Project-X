/** Bounded source lifecycle: Symbol12 hit/death and Page1 allied createship.
 * Shared simulation owns damage sequencing, identities, rollback and publication.
 * All draws here advance a local copy; throwing cannot advance the live stream.
 */
import type { LifecycleHitContext, LifecycleHitResult, StationHitContext, StationMembershipContext, StationMembershipPolicyRecord } from '../../src/simulation/contracts/lifecycle-rules';
import { LifecycleHitResultSchema } from '../../src/simulation/contracts/lifecycle-rules';
import { nextRandomInteger } from '../../src/random/seeded-random';
import { ordinaryLifecycleMetadata, lifecycleMetadata, LIFECYCLE_SYSTEM_IDS, MUTABLE_STATION_RECORD_IDS,
  STANDING_SYSTEM_IDS, STRENGTH_SYSTEM_IDS } from './lifecycle-content';
import type { NpcGeneration, StationMembership } from '../../src/simulation/model/lifecycle-state';
import { sourceStageToWorld } from './source-geometry';

export const BM1_LIFECYCLE_POLICY = 'bm1-station-lifecycle';

const mutableRecords = MUTABLE_STATION_RECORD_IDS;
const selectedRecords = lifecycleMetadata.stations.filter(row => LIFECYCLE_SYSTEM_IDS.includes(row.homeSystemId));
const recordsById = new Map(lifecycleMetadata.stations.map(row => [row.id, row]));
// Only five groups have coupled signs. Index once rather than scanning the
// complete source table for each of159 mutable records at every save/hit.
const coupledGroups = [...new Set(selectedRecords.map(row => row.aliasGroup))]
  .map(alias => lifecycleMetadata.stations.filter(row => row.aliasGroup === alias))
  .filter(group => group.length > 1);
/** Government-specific source createship inputs. Only reviewed home systems
 * may generate actors; the shared engine does not know these factions. */
function generationProfile(systemId: number) {
  if (!STRENGTH_SYSTEM_IDS.includes(systemId)) return null;
  const government = lifecycleMetadata.governments.find(row => row.systemId === systemId)?.governmentId;
  return ordinaryLifecycleMetadata.governmentProfiles.find(profile => profile.governmentId === government) ?? null;
}
/** Sparse overrides are canonical. All reachable alias deaths invert both rows,
 * so unequal effective signs are impossible even in an entry snapshot. Content
 * defaults and the mutable scope must match the reviewed census before a world
 * can be constructed. The optional projection supports direct pure-policy tests;
 * the engine always supplies actual validated authored content. */
export function validateStationMembership(overrides: readonly StationMembership[],
  records?: readonly StationMembershipPolicyRecord[]): boolean {
  if (records && (records.length !== selectedRecords.length || !selectedRecords.every(row => {
    const record = records.find(candidate => candidate.id === row.id);
    return record?.initialPresence === row.initiallyPresent && record.mutable === mutableRecords.includes(row.id);
  }))) return false;
  if (new Set(overrides.map(entry => entry.stationRecordId)).size !== overrides.length) return false;
  if (!overrides.every(entry => mutableRecords.includes(entry.stationRecordId)
    && entry.present !== recordsById.get(entry.stationRecordId)?.initiallyPresent)) return false;
  // Every authenticated exact-name group starts positive and each settlement
  // inverts all its rows, even when the actors belong to different systems.
  return coupledGroups.every(group => new Set(group.map(row => overrides
    .find(entry => entry.stationRecordId === row.id)?.present ?? row.initiallyPresent)).size === 1);
}

/** Source global exact-name inversion, bounded to reviewed record identities.
 * Called for live settlement and deterministic save replay; it never mutates
 * a world or consumes randomness. A true intent resets the sparse default. */
export function resolveStationMembership(context: StationMembershipContext): readonly StationMembership[] {
  if (!validateStationMembership(context.stationMembershipOverrides)) throw new Error('Invalid source station membership.');
  const dying = recordsById.get(context.stationRecordId);
  if (!dying || !mutableRecords.includes(dying.id)) throw new Error('Station membership is outside the reviewed scope.');
  return lifecycleMetadata.stations.filter(row => row.aliasGroup === dying.aliasGroup).map(row => ({
    stationRecordId: row.id,
    present: !(context.stationMembershipOverrides.find(entry => entry.stationRecordId === row.id)?.present ?? row.initiallyPresent),
  }));
}

/** Save-boundary validation uses the same reviewed roster/name facts as creation. */
export function validateGeneratedActor(context: Readonly<{
  definitionId: number;
  systemId: number;
  generation: NpcGeneration;
}>): boolean {
  const profile = generationProfile(context.systemId);
  if (!profile) return false;
  const name = context.generation.name.slice(profile.namePrefix.length);
  return context.generation.policyId === BM1_LIFECYCLE_POLICY
    && context.generation.governmentId === profile.governmentId && context.generation.raceId === profile.raceId
    && (!context.generation.blameDeath || context.generation.playerAttributed)
    && (profile.roster as readonly number[]).includes(context.definitionId)
    && context.generation.name.startsWith(profile.namePrefix)
    && lifecycleMetadata.names.includes(name);
}

/** Ordinary station strength is one scalar, not fabricated hull/shield layers. */
export function resolveStationHit(context: StationHitContext): number {
  return Math.max(0, context.target.strength - context.weapon.baseDamage * context.attacker.sizeClass);
}

export function resolveLifecycleHit(context: LifecycleHitContext): LifecycleHitResult {
  const { actor, system } = context;
  const profile = generationProfile(system.id);
  const expected = lifecycleMetadata.governments.find(row => row.systemId === system.id);
  if (!profile || !expected || system.governmentId !== expected.governmentId
    || system.opposingGovernmentId !== expected.opposingGovernmentId || system.initialStrength !== expected.initialStrength) {
    throw new Error('Unsupported station lifecycle system.');
  }
  const station = actor.kind === 'station';
  if (station && !mutableRecords.includes(actor.stationRecordId ?? '')) {
    throw new Error('Station combat is outside the reviewed scope.');
  }
  const stationRecord = station ? lifecycleMetadata.stations.find(row => row.id === actor.stationRecordId) : null;
  if (station && (stationRecord?.structureDefinitionId !== actor.definitionId || stationRecord.homeSystemId !== system.id)) {
    throw new Error('Station source identity differs.');
  }
  const consumesStrength = STRENGTH_SYSTEM_IDS.includes(system.id);
  if (consumesStrength && (system.strength === null || !Number.isFinite(system.strength))) {
    throw new Error('Missing consumed system strength.');
  }
  if (!station && (!actor.generation || !validateGeneratedActor({
    definitionId: actor.definitionId, systemId: system.id, generation: actor.generation,
  }))) throw new Error('Unknown source-generated defender.');
  const standingBySystem = new Map(context.systemStanding.map(entry => [entry.systemId, entry.value]));
  if (context.systemStanding.length !== STANDING_SYSTEM_IDS.length || standingBySystem.size !== STANDING_SYSTEM_IDS.length
    || !STANDING_SYSTEM_IDS.every(id => Number.isFinite(standingBySystem.get(id)))) {
    throw new Error('Missing consumed prestige scope.');
  }
  let randomState = context.randomState;
  const draw = (bound: number) => {
    const result = nextRandomInteger(randomState, bound);
    randomState = result.state;
    return result.value;
  };
  // firephaser establishes player targeting before the source hit callback.
  // Sticky blame consumes random(5) on every accepted hit, even if nonlethal.
  const playerAttributed = true;
  const blameDeath = draw(5) === 1 || actor.blameDeath;
  const unchanged = {
    playerAttributed, blameDeath, stationMembershipUpdates: [], standingUpdates: [],
    strengthUpdates: [], communication: null, spawns: [], notice: null,
  };
  if (actor.remainingStrength > 0) return LifecycleHitResultSchema.parse({ ...unchanged, randomState });

  // Local friendly penalty precedes the source same-government scan. Merge
  // the local key once so no update can overwrite another effect for that key.
  const localStanding = standingBySystem.get(system.id)! - actor.sizeClass * draw(5);
  // Independent government12 skips the global scan, but still receives its
  // local size penalty and final blamed-station clamp. Keep the local effect
  // even when the authenticated fan-out is empty.
  const updatedStanding = new Map<number, number>([[system.id, localStanding]]);
  profile.standingFanoutSystemIds.forEach(systemId => {
    updatedStanding.set(systemId, (updatedStanding.get(systemId) ?? standingBySystem.get(systemId)!) - 1);
  });
  if (station && blameDeath && updatedStanding.get(system.id)! >= 0) updatedStanding.set(system.id, -1);
  const standingUpdates = [...updatedStanding].sort(([left],[right]) => left-right)
    .map(([systemId,value]) => ({systemId,value}));
  const membershipUpdates = station ? resolveStationMembership({stationRecordId: actor.stationRecordId!,
    stationMembershipOverrides: context.stationMembershipOverrides}) : [];

  // The full source census, including unstaged records, owns this predicate.
  const remaining = lifecycleMetadata.stations.filter(row => row.homeSystemId === system.id).filter(row => {
    const update = membershipUpdates.find(update => update.stationRecordId === row.id);
    if (update) return update.present;
    const override = context.stationMembershipOverrides.find(override => override.stationRecordId === row.id);
    return override?.present ?? row.initiallyPresent;
  });
  // Every ordinary source row is now mutable. Count durable source membership,
  // never active actors: a surviving alias actor may have a negative source row.
  if (!validateStationMembership(context.stationMembershipOverrides)
    || (!consumesStrength && remaining.length === 0)) throw new Error('Surviving census invariant differs.');
  const noStations = remaining.length === 0;
  const priorStrength = consumesStrength ? system.strength! : system.initialStrength;
  const strength = noStations ? priorStrength - actor.sizeClass * 10 : priorStrength;
  const communication = noStations && station ? {
    code: 'last-station-fleet', message: 'Sensors detect a large fleet entering this system...',
  } : null;
  // Exactly ten explicit allied requests for the station report, followed by the
  // independent ordinary replacement predicate using the updated signed strength.
  const count = (communication ? 10 : 0) + (strength > 0 ? 1 : 0);
  const spawns = Array.from({ length: count }, () => {
    // Each allied request resets its source government context; there is no fleet-size draw.
    const roster = profile.roster;
    const definitionId = roster[draw(roster.length)];
    const sourceName = lifecycleMetadata.names[draw(219)];
    const name = profile.namePrefix + sourceName;
    if (!definitionId || !sourceName) throw new Error('Invalid reviewed allied roster/name.');
    // Source stage coordinates are converted through the same player anchor used
    // by the maintained peaceful createship fixture (source draw order retained).
    const stageX = draw(5000) - draw(5000);
    const stageY = draw(5000) - draw(5000);
    const position = sourceStageToWorld({ x: stageX, y: stageY }, context.playerPosition, context.cameraZoom);
    const targetCoin = draw(2);
    let targetEntityId: string | null = context.planetEntityId;
    if (targetCoin === 1 && context.stationSlots.length > 0) {
      // Cached entry cursor is the bound: includes leading null and cleared holes.
      // A removed/absent slot stays null; never reroll and alter later RNG.
      targetEntityId = context.stationSlots[draw(context.stationSlots.length)] ?? null;
    }
    return {
      definitionId, name, governmentId: system.governmentId,
      raceId: profile.raceId,
      position, rotationDegrees: 0, targetEntityId,
    };
  });
  return LifecycleHitResultSchema.parse({
    playerAttributed, blameDeath, stationMembershipUpdates: membershipUpdates, standingUpdates,
    strengthUpdates: noStations ? [{ systemId: system.id, value: strength }] : [],
    communication, spawns, randomState,
    notice: { code: 'actor-destroyed', message: 'Sensors have detected a large explosion in this system...' },
  });
}
