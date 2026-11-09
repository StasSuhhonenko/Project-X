/** Bounded source lifecycle: Symbol12 hit/death and Page1 allied createship.
 * Shared simulation owns damage sequencing, identities, rollback and publication.
 * All draws here advance a local copy; throwing cannot advance the live stream.
 */
import { nextRandomInteger } from '@engine/random/seeded-random';
import type {
  LifecycleHitContext,
  LifecycleHitResult,
  StationHitContext,
  StationMembershipContext,
  StationMembershipPolicyRecord,
} from '@engine/simulation/contracts/lifecycle-rules';
import { LifecycleHitResultSchema } from '@engine/simulation/contracts/lifecycle-rules';
import type { NpcGeneration, StationMembership } from '@engine/simulation/model/lifecycle-state';
import {
  drawInitialTargetSlot,
  drawStagePosition,
  isAlliedShipIdentity,
  isSpawnableShip,
  selectRosterShip,
  selectShipName,
  type SourceDraw,
} from './createship';
import {
  LIFECYCLE_SYSTEM_IDS,
  lifecycleMetadata,
  MUTABLE_STATION_RECORD_IDS,
  STANDING_SYSTEM_IDS,
  standingFanoutSystemIds,
  STRENGTH_SYSTEM_IDS,
} from './lifecycle-content';
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
/** Sparse overrides are canonical. All reachable alias deaths invert both rows,
 * so unequal effective signs are impossible even in an entry snapshot. Content
 * defaults and the mutable scope must match the reviewed census before a world
 * can be constructed. The optional projection supports direct pure-policy tests;
 * the engine always supplies actual validated authored content. */
export function validateStationMembership(
  overrides: readonly StationMembership[],
  records?: readonly StationMembershipPolicyRecord[]
): boolean {
  if (
    records &&
    (records.length !== selectedRecords.length ||
      !selectedRecords.every(row => {
        const record = records.find(candidate => candidate.id === row.id);
        return record?.initialPresence === row.initiallyPresent && record.mutable === mutableRecords.includes(row.id);
      }))
  )
    return false;
  if (new Set(overrides.map(entry => entry.stationRecordId)).size !== overrides.length) return false;
  if (
    !overrides.every(
      entry =>
        mutableRecords.includes(entry.stationRecordId) &&
        entry.present !== recordsById.get(entry.stationRecordId)?.initiallyPresent
    )
  )
    return false;
  // Every authenticated exact-name group starts positive and each settlement
  // inverts all its rows, even when the actors belong to different systems.
  return coupledGroups.every(
    group =>
      new Set(
        group.map(row => overrides.find(entry => entry.stationRecordId === row.id)?.present ?? row.initiallyPresent)
      ).size === 1
  );
}

/** Source global exact-name inversion, bounded to reviewed record identities.
 * Called for live settlement and deterministic save replay; it never mutates
 * a world or consumes randomness. A true intent resets the sparse default. */
export function resolveStationMembership(context: StationMembershipContext): readonly StationMembership[] {
  if (!validateStationMembership(context.stationMembershipOverrides))
    throw new Error('Invalid source station membership.');
  const dying = recordsById.get(context.stationRecordId);
  if (!dying || !mutableRecords.includes(dying.id))
    throw new Error('Station membership is outside the reviewed scope.');
  return lifecycleMetadata.stations
    .filter(row => row.aliasGroup === dying.aliasGroup)
    .map(row => ({
      stationRecordId: row.id,
      present: !(
        context.stationMembershipOverrides.find(entry => entry.stationRecordId === row.id)?.present ??
        row.initiallyPresent
      ),
    }));
}

/** Save-boundary validation uses the same reviewed roster/name facts as creation. */
export function validateGeneratedActor(
  context: Readonly<{
    definitionId: number;
    systemId: number;
    generation: NpcGeneration;
  }>
): boolean {
  if (!STRENGTH_SYSTEM_IDS.includes(context.systemId)) return false;
  const government = lifecycleMetadata.governments.find(row => row.systemId === context.systemId)?.governmentId;
  if (!government) return false;
  return (
    context.generation.policyId === BM1_LIFECYCLE_POLICY &&
    context.generation.governmentId === government &&
    isAlliedShipIdentity(government, context.definitionId, context.generation.raceId, context.generation.name)
  );
}

/** Ordinary station strength is one scalar, not fabricated hull/shield layers. */
export function resolveStationHit(context: StationHitContext): number {
  return Math.max(0, context.target.strength - context.weapon.baseDamage * context.attacker.sizeClass);
}

export function resolveLifecycleHit(context: LifecycleHitContext): LifecycleHitResult {
  let randomState = context.randomState;
  const draw: SourceDraw = bound => {
    const result = nextRandomInteger(randomState, bound);
    randomState = result.state;
    return result.value;
  };
  return LifecycleHitResultSchema.parse({ ...planLifecycleHit(context, draw), randomState });
}

/** One death policy for stations, reviewed C2 defenders and ordinary ships.
 * Injectable world draws pin source bounds/order independently of LCG seeds. */
export function planLifecycleHit(
  context: LifecycleHitContext,
  draw: SourceDraw
): Omit<LifecycleHitResult, 'randomState'> {
  const { actor, system } = context;
  const station = actor.kind === 'station';
  if (!station && actor.stationRecordId !== null) throw new Error('A ship cannot carry a station source identity.');
  const expected = lifecycleMetadata.governments.find(row => row.systemId === system.id);
  if (
    station &&
    (!expected ||
      system.governmentId !== expected.governmentId ||
      system.opposingGovernmentId !== expected.opposingGovernmentId ||
      system.initialStrength !== expected.initialStrength)
  ) {
    throw new Error('Unsupported station lifecycle system.');
  }
  if (station && !mutableRecords.includes(actor.stationRecordId ?? '')) {
    throw new Error('Station combat is outside the reviewed scope.');
  }
  const stationRecord = station ? lifecycleMetadata.stations.find(row => row.id === actor.stationRecordId) : null;
  if (
    station &&
    (stationRecord?.structureDefinitionId !== actor.definitionId || stationRecord.homeSystemId !== system.id)
  ) {
    throw new Error('Station source identity differs.');
  }
  const consumesStrength = STRENGTH_SYSTEM_IDS.includes(system.id);
  if (consumesStrength && (system.strength === null || !Number.isFinite(system.strength))) {
    throw new Error('Missing consumed system strength.');
  }
  if (
    !station &&
    actor.generation &&
    !validateGeneratedActor({
      definitionId: actor.definitionId,
      systemId: system.id,
      generation: actor.generation,
    })
  )
    throw new Error('Unknown source-generated defender.');
  const standingBySystem = new Map(context.systemStanding.map(entry => [entry.systemId, entry.value]));
  if (
    context.systemStanding.length !== STANDING_SYSTEM_IDS.length ||
    standingBySystem.size !== STANDING_SYSTEM_IDS.length ||
    !STANDING_SYSTEM_IDS.every(id => Number.isFinite(standingBySystem.get(id)))
  ) {
    throw new Error('Missing consumed prestige scope.');
  }
  // Symbol-12-11050.as:275–287. Player emission establishes targeting before
  // this callback; NPC impacts do not. Every accepted hit draws, even survivors.
  const playerAttributed = actor.targetsPlayer;
  const blameDeath = (draw(5) === 1 && actor.targetsPlayer) || actor.blameDeath;
  const unchanged = {
    playerAttributed,
    blameDeath,
    stationMembershipUpdates: [],
    standingUpdates: [],
    strengthUpdates: [],
    communication: null,
    spawns: [],
    notice: null,
  };
  if (actor.remainingStrength > 0) return unchanged;

  // Local friendly penalty precedes the source same-government scan. Merge
  // the local key once so no update can overwrite another effect for that key.
  const updatedStanding = new Map<number, number>();
  const addStanding = (systemId: number, delta: number) => {
    const prior = updatedStanding.get(systemId) ?? standingBySystem.get(systemId);
    // Declared standing is the capability boundary; consume eligible draws
    // even when the source system has no declared persistent standing slot.
    if (prior === undefined) return;
    updatedStanding.set(systemId, prior + delta);
  };
  let tallyDelta: LifecycleHitResult['tallyDelta'];
  // Symbol-12-23015.as:3–19. Stations retain delivered C2 attribution.
  if (actor.targetsPlayer || (blameDeath && system.governmentId !== 16)) {
    if (actor.governmentId === 12 || (system.governmentId !== null && actor.governmentId === system.governmentId))
      addStanding(system.id, -actor.sizeClass * draw(5));
    // Independent `if`: overlapping governments take BOTH random(5) draws.
    if (
      (system.opposingGovernmentId !== null && actor.governmentId === system.opposingGovernmentId) ||
      actor.governmentId === 15
    ) {
      tallyDelta = { mercenary: 1 }; // rep[4], Page-3-88826.as:52–53.
      addStanding(system.id, actor.sizeClass * draw(5));
    }
    standingFanoutSystemIds(actor.governmentId).forEach(systemId => addStanding(systemId, -1));
  }
  if (
    station &&
    blameDeath &&
    system.governmentId !== 16 &&
    (updatedStanding.get(system.id) ?? standingBySystem.get(system.id) ?? -1) >= 0
  )
    updatedStanding.set(system.id, -1);
  const standingUpdates = [...updatedStanding]
    .sort(([left], [right]) => left - right)
    .map(([systemId, value]) => ({ systemId, value }));
  const membershipUpdates = station
    ? resolveStationMembership({
        stationRecordId: actor.stationRecordId!,
        stationMembershipOverrides: context.stationMembershipOverrides,
      })
    : [];

  // Symbol-12-23015.as:33–55: membership then full source census, including
  // unstaged records. Gate-independent census counts rows, never live actors.
  const remaining = lifecycleMetadata.stations
    .filter(row => row.homeSystemId === system.id)
    .filter(row => {
      const update = membershipUpdates.find(update => update.stationRecordId === row.id);
      if (update) return update.present;
      const override = context.stationMembershipOverrides.find(override => override.stationRecordId === row.id);
      return override?.present ?? row.initiallyPresent;
    });
  // Every ordinary source row is now mutable. Count durable source membership,
  // never active actors: a surviving alias actor may have a negative source row.
  if (!validateStationMembership(context.stationMembershipOverrides))
    throw new Error('Surviving census invariant differs.');
  const noStations = remaining.length === 0 && system.governmentId !== 16;
  const priorStrength = consumesStrength ? system.strength! : system.initialStrength;
  const strength = noStations ? priorStrength - actor.sizeClass * 10 : priorStrength;
  const communication =
    noStations && station
      ? {
          code: 'last-station-fleet',
          message: 'Sensors detect a large fleet entering this system...',
        }
      : null;
  // Symbol-12-23015.as:57–70: exactly ten explicit allied requests for the station report, followed by the
  // independent ordinary replacement predicate using the updated signed strength.
  // No capability is invented outside supported ordinary strength scope.
  // Unowned source government0 is null: traders12 are friendly but not local,
  // so they lose prestige and census strength, and never trigger replacement.
  const count =
    (communication ? 10 : 0) + (consumesStrength && actor.governmentId === system.governmentId && strength > 0 ? 1 : 0);
  const spawns = Array.from({ length: count }, () => {
    // Each allied request (createship with mygovt = -1) resets its source government
    // context; there is no fleet-size draw. The shared createship draws keep this
    // order identical to C10a visit encounters.
    const ship = selectRosterShip(system.governmentId ?? 0, draw);
    const name = selectShipName(ship.raceId, draw);
    // Source stage coordinates are converted through the same player anchor used
    // by the maintained peaceful createship fixture (source draw order retained).
    const position = sourceStageToWorld(drawStagePosition(draw), context.playerPosition, context.cameraZoom);
    const slot = drawInitialTargetSlot(draw, context.stationSlots.length);
    return {
      definitionId: ship.definitionId,
      name,
      governmentId: system.governmentId === 16 ? 12 : (system.governmentId ?? 12),
      raceId: ship.raceId,
      position,
      rotationDegrees: 0,
      targetEntityId: slot === null ? context.planetEntityId : (context.stationSlots[slot] ?? null),
    };
  }).filter(spawn => isSpawnableShip(spawn.definitionId)); // C10a missing-art adaptation, draws retained.
  return {
    playerAttributed,
    blameDeath,
    stationMembershipUpdates: membershipUpdates,
    standingUpdates,
    ...(tallyDelta ? { tallyDelta } : {}),
    strengthUpdates: noStations && consumesStrength ? [{ systemId: system.id, value: strength }] : [],
    communication,
    spawns,
    notice: { code: 'actor-destroyed', message: 'Sensors have detected a large explosion in this system...' },
  };
}
