/** Pure preparation and atomic application of a consumed station/actor hit. */
import type { EntityDefinition, ShipDefinition, WeaponDefinition } from '../../content/schemas/game-content';
import type { SystemDefinition } from '../../content/schemas/game-module';
import type { LifecycleDefinition } from '../../content/schemas/lifecycle-content';
import type { GameRules } from '../contracts/game-rules';
import {
  LifecycleHitAttackerSchema,
  LifecycleHitResultSchema,
  type LifecycleHitContext,
  type LifecycleHitResult,
} from '../contracts/lifecycle-rules';
import { captureActorDeath } from '../model/actor-death-event';
import { actorCombat, actorNavigation, actorSize, clearActorTarget, isDecisionActor } from '../model/decision-actor';
import { DurabilityComponentSchema, type DurabilityComponent, type Position } from '../model/entity-components';
import { fleetAfterDeaths } from '../model/fleet-state';
import { applyStandingUpdates, hasExactStandingScope, isValidStationSpawnSlots } from '../model/lifecycle-state';
import type { StationMembership } from '../model/lifecycle-state';
import { createNpcCombatState, deriveNpcRandomState } from '../model/npc-state';
import { applyProgressionDelta, type ProgressionDefinition } from '../model/progression-state';
import {
  parseWorldState,
  selectPlayerEntity,
  selectWorldEntity,
  type NpcShipEntity,
  type PrimaryWeaponState,
  type WorldState,
} from '../model/world-state';
import { validateActiveStationVisit } from './active-station-visit';
import { NPC_DESTRUCTION_NOTICE } from './destruction';
import { equalStationMembership, resolveStationMembershipSettlement } from './station-membership';

export interface LifecycleDefinitions {
  getEntityDefinition(id: number): EntityDefinition | undefined;
  getShipDefinition(id: number): ShipDefinition | undefined;
}

/** Adapt ship-only fixtures and full catalogs through one lifecycle lookup rule.
 * Wrappers preserve the catalog receiver when its methods use owned state. */
export function createLifecycleDefinitions(definitions: {
  getEntityDefinition?(id: number): EntityDefinition | undefined;
  getShipDefinition(id: number): ShipDefinition | undefined;
}): LifecycleDefinitions {
  return {
    getEntityDefinition: id => definitions.getEntityDefinition?.(id) ?? definitions.getShipDefinition(id),
    getShipDefinition: id => definitions.getShipDefinition(id),
  };
}

export interface PreparedLifecycleHit {
  readonly targetId: string;
  readonly priorCondition: DurabilityComponent | null;
  readonly priorStrength: number | null;
  readonly priorBlameDeath: boolean;
  readonly priorTargetEntityId: string | null;
  readonly priorRandomState: number;
  readonly remainingStrength: number;
  readonly condition: DurabilityComponent | null;
  readonly result: LifecycleHitResult;
  readonly policyId: string;
  readonly systemId: number;
  readonly orderedStationIds: readonly string[];
  readonly settledStationRecordId: string | null;
  readonly stationMembershipOverrides: readonly StationMembership[];
}

/**
 * Prepare from immutable prior facts. RNG and effects remain detached until the
 * enclosing tick succeeds. Every live ship uses the same settlement owner.
 */
export function prepareLifecycleHit(
  world: WorldState,
  armament: PrimaryWeaponState,
  vessel: ShipDefinition,
  weapon: WeaponDefinition | null,
  playerPosition: Position,
  cameraZoom: number,
  rules: GameRules,
  definitions: LifecycleDefinitions,
  systems: readonly SystemDefinition[],
  lifecycle?: LifecycleDefinition
): PreparedLifecycleHit | null {
  const shot = armament.lastAcceptedShot;
  if (!shot || shot.targetEntityId === null || shot.sequence <= armament.resolvedShotSequence) return null;
  if (!weapon || weapon.id !== shot.weaponDefinitionId)
    throw new Error('Accepted hit weapon differs from its history.');
  return prepareActorHit(
    world,
    shot.targetEntityId,
    { kind: 'player' },
    vessel.sizeClass,
    weapon,
    playerPosition,
    cameraZoom,
    rules,
    definitions,
    systems,
    lifecycle
  );
}

/** Sole damage/outcome preparation for live ships and supported stations.
 * NPC beam callers supply identity directly, without synthesizing player history.
 * A missing policy (or explicit null result) retains outcome-free removal. */
export function prepareActorHit(
  world: WorldState,
  targetId: string,
  attacker: LifecycleHitContext['attacker'],
  attackerSizeClass: number,
  weapon: WeaponDefinition | null,
  playerPosition: Position,
  cameraZoom: number,
  rules: GameRules,
  definitions: LifecycleDefinitions,
  systems: readonly SystemDefinition[],
  lifecycle?: LifecycleDefinition
): PreparedLifecycleHit | null {
  LifecycleHitAttackerSchema.parse(attacker);
  if (attacker.kind === 'npc' && attacker.sizeClass !== attackerSizeClass)
    throw new Error('NPC hit size differs from its attacker identity.');
  const actor = selectWorldEntity(world, targetId);
  if (!actor || !isDecisionActor(actor)) return null;
  if (actor.kind === 'npc-ship' && actor.condition.hull === 0) return null;
  if (!weapon) throw new Error('Hit weapon is unavailable.');
  if (actor.kind === 'station' && (!lifecycle || !rules.resolveLifecycleHit))
    throw new Error('Station lifecycle policy is unavailable.');
  const definition = definitions.getEntityDefinition(actor.definitionId);
  const system = systems.find(candidate => candidate.id === actor.location.systemId);
  const planet = world.entities.find(entity => entity.kind === 'planet');
  if (!definition) throw new Error('Hit actor definition is unavailable.');
  if (lifecycle && system) validateActiveStationVisit(world, system, lifecycle, rules);
  if (actor.kind === 'npc-ship' && actor.generation && actor.generation.policyId !== lifecycle?.policyId)
    throw new Error('Generated actor belongs to an unavailable policy.');

  // A missing/foreign scope is invalid even when this hit would be nonlethal.
  // Reject before any module damage/settlement policy can observe partial facts.
  if (lifecycle && !hasExactStandingScope(world.lifecycle.systemStanding, lifecycle.standingSystemIds))
    throw new Error('Lifecycle standing differs from the declared consumed scope.');

  let condition: DurabilityComponent | null = null;
  let remainingStrength: number;
  if (actor.kind === 'station') {
    if (
      !actor.combat ||
      !rules.resolveStationHit ||
      !lifecycle?.mutableStationRecordIds.includes(actor.combat.recordId)
    )
      throw new Error('Station damage capability is unavailable.');
    remainingStrength = rules.resolveStationHit(
      Object.freeze({
        attacker: Object.freeze({ sizeClass: attackerSizeClass }),
        weapon: Object.freeze({ id: weapon.id, baseDamage: weapon.baseDamage }),
        target: Object.freeze({ strength: actor.combat.strength, maximumStrength: actor.combat.maximumStrength }),
      })
    );
    if (!Number.isFinite(remainingStrength) || remainingStrength < 0 || remainingStrength > actor.combat.strength)
      throw new Error('Station hit returned invalid or increasing strength.');
  } else {
    condition = DurabilityComponentSchema.parse(
      rules.resolvePrimaryHit(
        Object.freeze({
          attacker: Object.freeze({ sizeClass: attackerSizeClass }),
          weapon: Object.freeze({ id: weapon.id, baseDamage: weapon.baseDamage }),
          target: Object.freeze({ condition: actor.condition }),
        })
      )
    );
    if (condition.hull > actor.condition.hull || condition.shields > actor.condition.shields)
      throw new Error('Module primary hit cannot increase target durability.');
    remainingStrength = condition.hull === 0 ? 0 : condition.hull + condition.shields;
  }
  // Stations keep their C2 attribution record; ships keep sticky blame in combat.
  const attribution = actorCombat(actor);
  const policyContext =
    system && planet
      ? Object.freeze({
          attacker: Object.freeze({ ...attacker }),
          playerPosition: Object.freeze({ ...playerPosition }),
          cameraZoom,
          system: Object.freeze({
            id: system.id,
            governmentId: system.governmentId,
            opposingGovernmentId: system.opposingGovernmentId,
            initialStrength: system.initialStrength,
            strength: world.lifecycle.systemStrength.find(entry => entry.systemId === system.id)?.value ?? null,
          }),
          actor: Object.freeze({
            id: actor.id,
            kind: actor.kind,
            definitionId: actor.definitionId,
            sizeClass: actorSize(definition),
            stationRecordId: actor.kind === 'station' ? actor.combat!.recordId : null,
            generation: actor.kind === 'npc-ship' ? actor.generation : null,
            governmentId: actor.kind === 'npc-ship' ? actor.governmentId : system.governmentId,
            targetsPlayer: actorNavigation(actor).targetEntityId === world.playerEntityId,
            remainingStrength,
            playerAttributed: actorNavigation(actor).targetEntityId === world.playerEntityId,
            blameDeath: attribution.blameDeath,
          }),
          systemStanding: Object.freeze(world.lifecycle.systemStanding.map(entry => Object.freeze({ ...entry }))),
          stationMembershipOverrides: world.lifecycle.stationMembershipOverrides,
          stationSlots: Object.freeze([...(world.lifecycle.stationSpawnSlots ?? [])]),
          planetEntityId: planet.id,
          randomState: world.randomState,
        })
      : null;
  if (rules.resolveLifecycleHit && !policyContext)
    throw new Error('Declared hit policy requires system and planet definitions.');
  const policyResult = policyContext ? rules.resolveLifecycleHit?.(policyContext) : null;
  const result = LifecycleHitResultSchema.parse(
    policyResult ?? {
      playerAttributed: false,
      blameDeath: attribution.blameDeath,
      stationMembershipUpdates: [],
      standingUpdates: [],
      strengthUpdates: [],
      communication: null,
      spawns: [],
      randomState: world.randomState,
      notice: remainingStrength === 0 ? NPC_DESTRUCTION_NOTICE : null,
    }
  );
  if (attribution.blameDeath && !result.blameDeath) throw new Error('Hit attribution cannot be cleared.');
  const memberships = result.stationMembershipUpdates.map(entry => entry.stationRecordId);
  const standings = result.standingUpdates.map(entry => entry.systemId);
  const strengths = result.strengthUpdates.map(entry => entry.systemId);
  if (
    new Set(strengths).size !== strengths.length ||
    result.strengthUpdates.some(update => {
      const prior = world.lifecycle.systemStrength.find(entry => entry.systemId === update.systemId);
      return !lifecycle?.strengthSystemIds.includes(update.systemId) || !prior || update.value > prior.value;
    })
  )
    throw new Error('Lifecycle strength effect is unavailable, duplicate or increasing.');
  if (
    new Set(memberships).size !== memberships.length ||
    memberships.some(id => !lifecycle?.mutableStationRecordIds.includes(id)) ||
    new Set(standings).size !== standings.length ||
    standings.some(
      id =>
        !lifecycle?.standingSystemIds.includes(id) ||
        !world.lifecycle.systemStanding.some(entry => entry.systemId === id)
    )
  )
    throw new Error('Lifecycle effect references an unavailable or duplicate record.');
  if (actor.kind !== 'station' && memberships.length) throw new Error('A ship cannot change station membership.');
  if (
    remainingStrength > 0 &&
    (memberships.length ||
      standings.length ||
      strengths.length ||
      Object.keys(result.tallyDelta ?? {}).length ||
      result.spawns.length ||
      result.notice ||
      result.communication)
  )
    throw new Error('A surviving hit cannot settle death effects.');
  result.spawns.forEach(spawn => {
    if (
      !lifecycle?.spawnShipDefinitionIds.includes(spawn.definitionId) ||
      !definitions.getShipDefinition(spawn.definitionId) ||
      !systems.some(
        candidate =>
          candidate.governmentId === spawn.governmentId || candidate.opposingGovernmentId === spawn.governmentId
      ) ||
      (spawn.targetEntityId !== null && !world.entities.some(entity => entity.id === spawn.targetEntityId))
    )
      throw new Error('Generated actor references an unavailable definition, government or target.');
    if (
      rules.validateGeneratedActor &&
      !rules.validateGeneratedActor(
        Object.freeze({
          definitionId: spawn.definitionId,
          systemId: actor.location.systemId,
          generation: Object.freeze({
            policyId: lifecycle!.policyId,
            governmentId: spawn.governmentId,
            raceId: spawn.raceId,
            name: spawn.name,
          }),
        })
      )
    )
      throw new Error('Generated actor identity is invalid for the selected module.');
  });
  if (result.spawns.length > (lifecycle?.maximumSpawnsPerDeath ?? 0))
    throw new Error('Lifecycle spawn count exceeds its authored limit.');
  const settledStationRecordId = remainingStrength === 0 && actor.kind === 'station' ? actor.combat!.recordId : null;
  const membership =
    settledStationRecordId === null
      ? null
      : resolveStationMembershipSettlement(
          settledStationRecordId,
          world.lifecycle.stationMembershipOverrides,
          lifecycle!,
          rules
        );
  if (membership && !equalStationMembership(result.stationMembershipUpdates, membership.updates))
    throw new Error('Station death membership effects disagree with the selected settlement policy.');
  return {
    targetId: actor.id,
    priorCondition: actor.kind === 'npc-ship' ? actor.condition : null,
    priorStrength: actor.kind === 'station' ? actor.combat!.strength : null,
    priorBlameDeath: attribution.blameDeath,
    priorTargetEntityId: actorNavigation(actor).targetEntityId,
    priorRandomState: world.randomState,
    remainingStrength,
    condition,
    result,
    policyId: lifecycle?.policyId ?? '',
    systemId: actor.location.systemId,
    orderedStationIds: (system?.stations ?? []).map(station => station.id),
    settledStationRecordId,
    stationMembershipOverrides: membership?.overrides ?? world.lifecycle.stationMembershipOverrides,
  };
}

/** Apply only after the regular tick commit; newly generated actors do not move yet. */
export function applyLifecycleHit(
  world: WorldState,
  prepared: PreparedLifecycleHit | null,
  definitions: LifecycleDefinitions,
  progression?: ProgressionDefinition
): WorldState {
  if (!prepared) return world;
  const { targetId, remainingStrength, result } = prepared;
  if (
    !world.entities.some(entity => entity.id === targetId) ||
    (prepared.settledStationRecordId !== null &&
      world.lifecycle.activeStationVisit?.settledStationRecordIds.includes(prepared.settledStationRecordId))
  )
    throw new Error('Lifecycle actor settlement has already been consumed.');
  const current = selectWorldEntity(world, targetId)!;
  if (
    world.randomState !== prepared.priorRandomState ||
    (isDecisionActor(current) && actorNavigation(current).targetEntityId !== prepared.priorTargetEntityId) ||
    (current.kind === 'npc-ship' &&
      (current.condition.hull !== prepared.priorCondition?.hull ||
        current.condition.shields !== prepared.priorCondition.shields ||
        current.combat.blameDeath !== prepared.priorBlameDeath)) ||
    (current.kind === 'station' &&
      (current.combat?.strength !== prepared.priorStrength ||
        current.combat.state.blameDeath !== prepared.priorBlameDeath))
  )
    throw new Error('Prepared hit facts changed before settlement.');
  const dead = remainingStrength === 0;
  const player = selectPlayerEntity(world);
  const notice = result.notice ? { ...result.notice, sequence: (player.feedback.notice?.sequence ?? 0) + 1 } : null;
  const communicationSequence = (player.feedback.communication?.sequence ?? 0) + 1;
  if (result.communication && !Number.isSafeInteger(communicationSequence))
    throw new Error('Communication sequence overflow.');
  const communication = result.communication
    ? { ...result.communication, sequence: communicationSequence }
    : player.feedback.communication;
  const entities = world.entities
    .filter(entity => !dead || entity.id !== targetId)
    .map(entity => {
      if (entity.kind === 'player-ship')
        return { ...entity, feedback: { notice: notice ?? entity.feedback.notice, communication } };
      if (entity.id === targetId && entity.kind === 'station' && entity.combat)
        return {
          ...entity,
          combat: {
            ...entity.combat,
            strength: remainingStrength,
            state: { ...entity.combat.state, blameDeath: result.blameDeath },
          },
        };
      if (dead && entity.id !== targetId) return clearActorTarget(entity, targetId);
      if (entity.kind !== 'npc-ship') return entity;
      if (entity.id === targetId)
        return {
          ...entity,
          condition: prepared.condition!,
          combat: { ...entity.combat, blameDeath: result.blameDeath },
          // Emission response owns retaliation for every ship. Impact settlement
          // updates durability/attribution only and must not replay or overwrite it.
        };
      return entity;
    });
  let nextSequence = world.nextEntitySequence;
  const spawns: NpcShipEntity[] = result.spawns.map(spawn => {
    const vessel = definitions.getShipDefinition(spawn.definitionId)!;
    if (!Number.isSafeInteger(nextSequence + 1)) throw new Error('Generated actor allocator overflow.');
    const id = `entity-${nextSequence++}`;
    return {
      id,
      kind: 'npc-ship',
      specialStatus: { engineDisabledFrames: 0, hitFlag: 0 },
      definitionId: spawn.definitionId,
      governmentId: spawn.governmentId,
      combat: createNpcCombatState(),
      randomState: deriveNpcRandomState(nextSequence - 1),
      encounter: null,
      location: { systemId: prepared.systemId, position: spawn.position, rotationDegrees: spawn.rotationDegrees },
      motion: { speedPerFrame: 0, desiredSpeedPerFrame: 0 },
      condition: { hull: vessel.maximumHull, shields: vessel.maximumShields },
      navigation: {
        targetEntityId: dead && spawn.targetEntityId === targetId ? null : spawn.targetEntityId,
        targetOffset: { x: 0, y: 0 },
      },
      tradeOffer: null,
      tradeSeed: null,
      tradeDemand: null,
      generation: {
        policyId: prepared.policyId,
        governmentId: spawn.governmentId,
        raceId: spawn.raceId,
        name: spawn.name,
      },
    };
  });
  const stationSpawnSlots = world.lifecycle.stationSpawnSlots?.map(id => (dead && id === targetId ? null : id)) ?? null;
  if (
    stationSpawnSlots !== null &&
    !isValidStationSpawnSlots(
      stationSpawnSlots,
      prepared.orderedStationIds,
      entities.filter(entity => entity.kind === 'station')
    )
  )
    throw new Error('Lifecycle generation roster differs from a possible ordered visit.');
  const activeStationVisit = world.lifecycle.activeStationVisit;
  if (prepared.settledStationRecordId !== null && !activeStationVisit)
    throw new Error('Station settlement requires an active visit witness.');
  const standing = applyStandingUpdates(world.lifecycle.systemStanding, result.standingUpdates);
  const settled = parseWorldState({
    ...world,
    ...(world.fleet ? { fleet: fleetAfterDeaths(world.fleet, dead ? new Set([targetId]) : new Set<string>()) } : {}),
    // Presentation facts are captured before removal; no notice or selection
    // gate may suppress a death. Departures never enter this settlement path.
    actorDeathEvents:
      dead && (current.kind === 'npc-ship' || current.kind === 'station')
        ? [...world.actorDeathEvents, captureActorDeath(current, world.tick)]
        : world.actorDeathEvents,
    randomState: result.randomState,
    nextEntitySequence: nextSequence,
    specialActorSlots: [
      ...world.specialActorSlots.map(id => (dead && id === targetId ? null : id)),
      ...spawns.map(spawn => spawn.id),
    ],
    selectedTargetEntityId: dead && world.selectedTargetEntityId === targetId ? null : world.selectedTargetEntityId,
    lifecycle: {
      ...world.lifecycle,
      stationMembershipOverrides: prepared.stationMembershipOverrides,
      activeStationVisit:
        prepared.settledStationRecordId === null
          ? activeStationVisit
          : {
              ...activeStationVisit!,
              settledStationRecordIds: [
                ...activeStationVisit!.settledStationRecordIds,
                prepared.settledStationRecordId,
              ],
            },
      systemStanding: standing,
      systemStrength: world.lifecycle.systemStrength.map(
        entry => result.strengthUpdates.find(update => update.systemId === entry.systemId) ?? entry
      ),
      stationSpawnSlots,
    },
    entities: [...entities, ...spawns],
  });
  return result.tallyDelta && Object.keys(result.tallyDelta).length > 0
    ? applyProgressionDelta(settled, { experience: {}, tallies: result.tallyDelta }, progression)
    : settled;
}
