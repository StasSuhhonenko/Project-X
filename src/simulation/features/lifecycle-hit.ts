/** Pure preparation and atomic application of a consumed station/actor hit. */
import type { EntityDefinition, ShipDefinition, WeaponDefinition } from '../../content/schemas/game-content';
import type { SystemDefinition } from '../../content/schemas/game-module';
import type { LifecycleDefinition } from '../../content/schemas/lifecycle-content';
import type { GameRules } from '../contracts/game-rules';
import { LifecycleHitResultSchema, type LifecycleHitResult } from '../contracts/lifecycle-rules';
import { DurabilityComponentSchema, type DurabilityComponent, type Position } from '../model/entity-components';
import { hasExactStandingScope, isValidStationSpawnSlots } from '../model/lifecycle-state';
import type { StationMembership } from '../model/lifecycle-state';
import {
  parseWorldState,
  selectPlayerEntity,
  selectWorldEntity,
  type NpcShipEntity,
  type PrimaryWeaponState,
  type WorldState,
} from '../model/world-state';
import { validateActiveStationVisit } from './active-station-visit';
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
 * enclosing tick succeeds. An ordinary encounter stays on its existing policy.
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
  const actor = selectWorldEntity(world, shot.targetEntityId);
  if (!actor || (actor.kind !== 'station' && actor.kind !== 'npc-ship')) return null;
  if (actor.kind === 'station' && !actor.combat) return null;
  if (actor.kind === 'npc-ship' && !actor.generation) return null;
  if (!lifecycle || !rules.resolveLifecycleHit || !weapon) throw new Error('Actor lifecycle policy is unavailable.');
  const definition = definitions.getEntityDefinition(actor.definitionId);
  const system = systems.find(candidate => candidate.id === actor.location.systemId);
  const planet = world.entities.find(entity => entity.kind === 'planet');
  if (!definition || !system || !planet) throw new Error('Actor lifecycle definitions are unavailable.');
  if (system.governmentId === null) throw new Error('Actor lifecycle requires an owned system.');
  validateActiveStationVisit(world, system, lifecycle, rules);
  if (actor.kind === 'npc-ship' && actor.generation?.policyId !== lifecycle.policyId)
    throw new Error('Generated actor belongs to an unavailable policy.');

  // A missing/foreign scope is invalid even when this hit would be nonlethal.
  // Reject before any module damage/settlement policy can observe partial facts.
  if (!hasExactStandingScope(world.lifecycle.systemStanding, lifecycle.standingSystemIds))
    throw new Error('Lifecycle standing differs from the declared consumed scope.');

  let condition: DurabilityComponent | null = null;
  let remainingStrength: number;
  if (actor.kind === 'station') {
    if (!actor.combat || !rules.resolveStationHit || !lifecycle.mutableStationRecordIds.includes(actor.combat.recordId))
      throw new Error('Station damage capability is unavailable.');
    remainingStrength = rules.resolveStationHit(
      Object.freeze({
        attacker: Object.freeze({ sizeClass: vessel.sizeClass }),
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
          attacker: Object.freeze({ sizeClass: vessel.sizeClass }),
          weapon: Object.freeze({ id: weapon.id, baseDamage: weapon.baseDamage }),
          target: Object.freeze({ condition: actor.condition }),
        })
      )
    );
    if (condition.hull > actor.condition.hull || condition.shields > actor.condition.shields)
      throw new Error('Generated actor hit cannot increase durability.');
    remainingStrength = condition.hull === 0 ? 0 : condition.hull + condition.shields;
  }
  const attribution = actor.kind === 'station' ? actor.combat! : actor.generation!;
  const result = LifecycleHitResultSchema.parse(
    rules.resolveLifecycleHit(
      Object.freeze({
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
          sizeClass: definition.category === 'ship' ? definition.sizeClass : definition.constructionScale,
          stationRecordId: actor.kind === 'station' ? actor.combat!.recordId : null,
          generation: actor.kind === 'npc-ship' ? actor.generation : null,
          remainingStrength,
          playerAttributed: attribution.playerAttributed,
          blameDeath: attribution.blameDeath,
        }),
        systemStanding: Object.freeze(world.lifecycle.systemStanding.map(entry => Object.freeze({ ...entry }))),
        stationMembershipOverrides: world.lifecycle.stationMembershipOverrides,
        stationSlots: Object.freeze([...(world.lifecycle.stationSpawnSlots ?? [])]),
        planetEntityId: planet.id,
        randomState: world.randomState,
      })
    )
  );
  if (!result.playerAttributed || (attribution.blameDeath && !result.blameDeath))
    throw new Error('Hit attribution cannot be cleared.');
  const memberships = result.stationMembershipUpdates.map(entry => entry.stationRecordId);
  const standings = result.standingUpdates.map(entry => entry.systemId);
  const strengths = result.strengthUpdates.map(entry => entry.systemId);
  if (
    new Set(strengths).size !== strengths.length ||
    result.strengthUpdates.some(update => {
      const prior = world.lifecycle.systemStrength.find(entry => entry.systemId === update.systemId);
      return !lifecycle.strengthSystemIds.includes(update.systemId) || !prior || update.value > prior.value;
    })
  )
    throw new Error('Lifecycle strength effect is unavailable, duplicate or increasing.');
  if (
    new Set(memberships).size !== memberships.length ||
    memberships.some(id => !lifecycle.mutableStationRecordIds.includes(id)) ||
    new Set(standings).size !== standings.length ||
    standings.some(
      id =>
        !lifecycle.standingSystemIds.includes(id) ||
        !world.lifecycle.systemStanding.some(entry => entry.systemId === id)
    )
  )
    throw new Error('Lifecycle effect references an unavailable or duplicate record.');
  if (actor.kind !== 'station' && memberships.length)
    throw new Error('A generated actor cannot change station membership.');
  if (
    remainingStrength > 0 &&
    (memberships.length ||
      standings.length ||
      strengths.length ||
      result.spawns.length ||
      result.notice ||
      result.communication)
  )
    throw new Error('A surviving hit cannot settle death effects.');
  result.spawns.forEach(spawn => {
    if (
      !lifecycle.spawnShipDefinitionIds.includes(spawn.definitionId) ||
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
          systemId: system.id,
          generation: Object.freeze({
            policyId: lifecycle.policyId,
            governmentId: spawn.governmentId,
            raceId: spawn.raceId,
            name: spawn.name,
            playerAttributed: false,
            blameDeath: false,
          }),
        })
      )
    )
      throw new Error('Generated actor identity is invalid for the selected module.');
  });
  if (result.spawns.length > lifecycle.maximumSpawnsPerDeath)
    throw new Error('Lifecycle spawn count exceeds its authored limit.');
  const settledStationRecordId = remainingStrength === 0 && actor.kind === 'station' ? actor.combat!.recordId : null;
  const membership =
    settledStationRecordId === null
      ? null
      : resolveStationMembershipSettlement(
          settledStationRecordId,
          world.lifecycle.stationMembershipOverrides,
          lifecycle,
          rules
        );
  if (membership && !equalStationMembership(result.stationMembershipUpdates, membership.updates))
    throw new Error('Station death membership effects disagree with the selected settlement policy.');
  return {
    targetId: actor.id,
    remainingStrength,
    condition,
    result,
    policyId: lifecycle.policyId,
    systemId: system.id,
    orderedStationIds: system.stations.map(station => station.id),
    settledStationRecordId,
    stationMembershipOverrides: membership?.overrides ?? world.lifecycle.stationMembershipOverrides,
  };
}

/** Apply only after the regular tick commit; newly generated actors do not move yet. */
export function applyLifecycleHit(
  world: WorldState,
  prepared: PreparedLifecycleHit | null,
  definitions: LifecycleDefinitions
): WorldState {
  if (!prepared) return world;
  const { targetId, remainingStrength, result } = prepared;
  if (
    !world.entities.some(entity => entity.id === targetId) ||
    (prepared.settledStationRecordId !== null &&
      world.lifecycle.activeStationVisit?.settledStationRecordIds.includes(prepared.settledStationRecordId))
  )
    throw new Error('Lifecycle actor settlement has already been consumed.');
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
            playerAttributed: result.playerAttributed,
            blameDeath: result.blameDeath,
          },
        };
      if (entity.kind !== 'npc-ship') return entity;
      if (entity.id === targetId && entity.generation)
        return {
          ...entity,
          condition: prepared.condition!,
          generation: {
            ...entity.generation,
            playerAttributed: result.playerAttributed,
            blameDeath: result.blameDeath,
          },
          navigation: { ...entity.navigation, targetEntityId: world.playerEntityId },
        };
      if (dead && entity.navigation.targetEntityId === targetId)
        return {
          ...entity,
          navigation: { ...entity.navigation, targetEntityId: null },
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
      specialStatus: { cloaked: false, engineDisabledFrames: 0, hitFlag: 0 },
      definitionId: spawn.definitionId,
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
        playerAttributed: false,
        blameDeath: false,
      },
    };
  });
  const stationSpawnSlots = world.lifecycle.stationSpawnSlots?.map(id => (dead && id === targetId ? null : id)) ?? null;
  if (
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
  const standing = world.lifecycle.systemStanding.map(
    entry => result.standingUpdates.find(update => update.systemId === entry.systemId) ?? entry
  );
  return parseWorldState({
    ...world,
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
}
