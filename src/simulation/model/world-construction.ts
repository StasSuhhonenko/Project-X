/** Convert one validated module start into the first authoritative component world. */
import { z } from 'zod';
import { NpcSpawnSchema, SystemDefinitionSchema, type SystemDefinition } from '../../content/schemas/game-module';
import { LifecycleDefinitionSchema, type LifecycleDefinition } from '../../content/schemas/lifecycle-content';
import { UInt32Schema } from '../../random/seeded-random';
import type { GameRules } from '../contracts/game-rules';
import { CalendarDateSchema, DurabilityComponentSchema } from './entity-components';
import {
  createEmptyLifecycle,
  isStationPresent,
  isValidStationSpawnSlots,
  SystemStandingSchema,
  type WorldLifecycle,
} from './lifecycle-state';
import {
  createNpcCombatState,
  deriveNpcRandomState,
  freezeNpcTargetState,
  StartingNpcPlacementSchema,
} from './npc-state';
import { StartingPlayerSchema, type StartingPlayer } from './player-state';
import { createProgressionState, type ProgressionDefinition } from './progression-state';
import {
  parseWorldState,
  type NpcShipEntity,
  type PlanetEntity,
  type PlayerShipEntity,
  type PrimaryWeaponState,
  type StationEntity,
  type WorldState,
} from './world-state';

const InitialPrimaryWeaponSchema = z
  .object({
    weaponDefinitionId: z.number().int().positive(),
    initialCooldownFrames: z.number().finite().nonnegative(),
  })
  .strict()
  .readonly();

/** The sole adapter from the flat module-start DTO to runtime components. */
function playerToEntity(id: string, player: StartingPlayer, armament: PrimaryWeaponState): PlayerShipEntity {
  return {
    id,
    kind: 'player-ship',
    equipment: null,
    specialStatus: { cloaked: false, engineDisabledFrames: 0, hitFlag: 0 },
    identity: player.identity ? { ...player.identity } : null,
    definitionId: player.entityDefinitionId,
    location: {
      systemId: player.systemId,
      position: { ...player.position },
      rotationDegrees: player.rotationDegrees,
    },
    motion: { speedPerFrame: player.speedPerFrame, flightMode: player.flightMode },
    condition: {
      hull: player.hull,
      shields: player.shields,
      energy: player.energy,
      repairing: player.repairing,
    },
    inventory: { resources: { ...player.resources }, cargo: [] },
    armament,
    feedback: { communication: null, notice: player.notice ? { ...player.notice } : null },
  };
}

/** Compose one system's static spatial entities at a fresh runtime ID range. */
export function createSystemSpatialEntities(
  system: SystemDefinition,
  firstEntitySequence: number,
  lifecycleDefinition?: LifecycleDefinition,
  lifecycleState: WorldLifecycle = createEmptyLifecycle()
): {
  readonly planet: PlanetEntity;
  readonly stations: readonly StationEntity[];
  readonly nextEntitySequence: number;
  readonly stationSpawnSlots: readonly (string | null)[] | null;
  readonly activeStationVisit: WorldLifecycle['activeStationVisit'];
} {
  const planet: PlanetEntity = {
    id: `entity-${firstEntitySequence}`,
    kind: 'planet',
    location: { systemId: system.id, position: { ...system.planet.placement.position }, rotationDegrees: 0 },
  };
  // Station offsets are relative to the planet INSTANCE origin, not map geometry.
  const records = lifecycleDefinition?.stationRecords ?? [];
  const presentStations = system.stations.filter(station => {
    const record = records.find(candidate => candidate.stationPlacementId === station.id);
    if (!record) return true;
    return isStationPresent(record, lifecycleState);
  });
  const stations: StationEntity[] = presentStations.map((station, index) => ({
    commodityMarket: null,
    id: `entity-${firstEntitySequence + index + 1}`,
    kind: 'station',
    stationId: station.id,
    definitionId: station.structureDefinitionId,
    combat: (() => {
      const record = records.find(candidate => candidate.stationPlacementId === station.id);
      return record
        ? {
            recordId: record.id,
            strength: record.initialStrength,
            maximumStrength: record.maximumStrength,
            state: createNpcCombatState(),
            navigation: { targetEntityId: null, targetOffset: { x: 0, y: 0 } },
            randomState: deriveNpcRandomState(firstEntitySequence + index + 1),
          }
        : null;
    })(),
    location: {
      systemId: system.id,
      position: {
        x: planet.location.position.x + station.positionOffset.x,
        y: planet.location.position.y + station.positionOffset.y,
      },
      rotationDegrees: station.rotationDegrees,
    },
  }));
  const capturesSlots = records.some(record => record.homeSystemId === system.id);
  const stationSpawnSlots = capturesSlots ? [null, ...stations.map(station => station.id)] : null;
  if (
    capturesSlots &&
    !isValidStationSpawnSlots(
      stationSpawnSlots,
      system.stations.map(station => station.id),
      stations
    )
  )
    throw new Error('Constructed station roster violates the ordered visit contract.');
  const activeStationVisit = capturesSlots
    ? {
        entryMembershipOverrides: lifecycleState.stationMembershipOverrides.map(entry => ({ ...entry })),
        settledStationRecordIds: [],
      }
    : null;
  return {
    planet,
    stations,
    nextEntitySequence: firstEntitySequence + 1 + stations.length,
    stationSpawnSlots,
    activeStationVisit,
  };
}

/** Untrusted start inputs remain validated by their owning schemas below.
 * Named fields prevent optional encounter/lifecycle inputs from shifting slots. */
export interface StartingWorldOptions {
  /** Declared namespaces initialize at zero; omit only for modules without progression. */
  readonly fleet?: GameRules['fleet'] | undefined;
  readonly progression?: ProgressionDefinition | undefined;
  readonly initialDate: unknown;
  readonly player: unknown;
  readonly system?: unknown;
  readonly npcSpawn?: unknown;
  readonly initialPrimaryWeapon?: unknown;
  readonly createStartingNpc?: GameRules['createStartingNpc'] | undefined;
  readonly npcDurability?: unknown;
  readonly lifecycleDefinition?: unknown;
  readonly standingDefaults?: unknown;
  readonly standingStartId?: string | undefined;
  readonly systems?: readonly SystemDefinition[] | undefined;
  /**
   * Optional uint32 session seed for the world (and progression) random
   * stream. Omitted, the stream continues from the authored starting-NPC
   * placement, so a start is fully reproducible (tests, fixtures). A browser
   * session passes fresh entropy, as the original seeded Flash `random()` from
   * the clock: otherwise every new game would roll the same entry encounter.
   * Authored starting-NPC placement stays deterministic either way.
   */
  readonly sessionSeed?: number | undefined;
}

/** A fresh start assigns player, planet, stations and NPC consecutive runtime IDs. */
export function createStartingWorld({
  fleet,
  progression,
  initialDate: initialDateInput,
  player: playerInput,
  system: systemInput,
  npcSpawn: npcSpawnInput,
  initialPrimaryWeapon: initialPrimaryWeaponInput,
  createStartingNpc,
  npcDurability: npcDurabilityInput,
  lifecycleDefinition: lifecycleDefinitionInput,
  standingDefaults: standingDefaultsInput,
  standingStartId,
  sessionSeed: sessionSeedInput,
  systems: systemsInput,
}: StartingWorldOptions): WorldState {
  const date = CalendarDateSchema.parse(initialDateInput);
  const lifecycleDefinition =
    lifecycleDefinitionInput === undefined ? undefined : LifecycleDefinitionSchema.parse(lifecycleDefinitionInput);
  const lifecycle: WorldLifecycle = {
    ...createEmptyLifecycle(),
    standingStartId: standingStartId ?? null,
    systemStanding:
      standingDefaultsInput === undefined ? [] : z.array(SystemStandingSchema).parse(standingDefaultsInput),
  };
  const strengthSystems =
    systemsInput ?? (systemInput === undefined ? [] : [SystemDefinitionSchema.parse(systemInput)]);
  const systemStrength = (lifecycleDefinition?.strengthSystemIds ?? []).map(systemId => {
    const authored = strengthSystems.find(system => system.id === systemId);
    if (!authored) throw new Error('Missing selected system definition for strength initialization.');
    return { systemId, value: authored.initialStrength };
  });
  const initializedLifecycle = { ...lifecycle, systemStrength };
  const sessionSeed = sessionSeedInput === undefined ? undefined : UInt32Schema.parse(sessionSeedInput);
  const player = StartingPlayerSchema.parse(playerInput);
  const system = systemInput === undefined ? undefined : SystemDefinitionSchema.parse(systemInput);
  const npcSpawn = npcSpawnInput === undefined ? undefined : NpcSpawnSchema.parse(npcSpawnInput);
  const initialPrimaryWeapon =
    initialPrimaryWeaponInput === undefined ? null : InitialPrimaryWeaponSchema.parse(initialPrimaryWeaponInput);
  const npcDurability = npcDurabilityInput === undefined ? null : DurabilityComponentSchema.parse(npcDurabilityInput);
  if (system && system.id !== player.systemId) throw new Error('Starting system must match the player system.');
  if (npcSpawn && !system) throw new Error('NPC spawn requires a starting system.');
  if (npcSpawn && !createStartingNpc) throw new Error('NPC spawn requires a module encounter rule.');
  if (npcSpawn && !npcDurability) throw new Error('NPC spawn requires initial durability.');
  const playerEntity = playerToEntity('entity-1', player, {
    weaponDefinitionId: initialPrimaryWeapon?.weaponDefinitionId ?? null,
    cooldownRemainingFrames: initialPrimaryWeapon?.initialCooldownFrames ?? 0,
    shotSequence: 0,
    resolvedShotSequence: 0,
    lastAcceptedShot: null,
  });
  const spatial = system ? createSystemSpatialEntities(system, 2, lifecycleDefinition, initializedLifecycle) : null;
  const planets = spatial ? [spatial.planet] : [];
  const stations = spatial?.stations ?? [];
  const targetCandidates = [playerEntity, ...planets, ...stations].map(entity =>
    freezeNpcTargetState({
      id: entity.id,
      kind: entity.kind,
      position: entity.location.position,
    })
  );
  const placement =
    npcSpawn && createStartingNpc
      ? StartingNpcPlacementSchema.parse(
          createStartingNpc(
            Object.freeze({
              encounterId: npcSpawn.encounterId,
              seed: npcSpawn.seed,
              playerPosition: playerEntity.location.position,
              targetCandidates: Object.freeze(targetCandidates),
            })
          )
        )
      : null;
  if (placement && !targetCandidates.some(candidate => candidate.id === placement.targetEntityId)) {
    throw new Error('Starting NPC target must be an engine-provided candidate.');
  }
  const npcs: NpcShipEntity[] =
    npcSpawn && placement
      ? [
          {
            tradeSeed: null,
            tradeDemand: null,
            id: `entity-${spatial!.nextEntitySequence}`,
            kind: 'npc-ship',
            specialStatus: { engineDisabledFrames: 0, hitFlag: 0 },
            definitionId: npcSpawn.shipDefinitionId,
            governmentId: npcSpawn.governmentId,
            combat: createNpcCombatState(),
            randomState: deriveNpcRandomState(spatial!.nextEntitySequence),
            encounter: null,
            location: { systemId: player.systemId, position: placement.position, rotationDegrees: 0 },
            motion: { speedPerFrame: 0, desiredSpeedPerFrame: 0 },
            condition: npcDurability!,
            navigation: { targetEntityId: placement.targetEntityId, targetOffset: placement.targetOffset },
            tradeOffer: npcSpawn.tradeOffer ?? null,
            generation: null,
          },
        ]
      : [];
  return parseWorldState({
    ...(fleet ? { fleet: { nextOwnedShipSequence: 1, ships: [], deployments: [] } } : {}),
    progression: createProgressionState(progression, sessionSeed ?? placement?.randomState ?? 0),
    status: 'active',
    date,
    tick: 0,
    cameraZoom: 1,
    nextEntitySequence: (spatial?.nextEntitySequence ?? 2) + npcs.length,
    randomState: sessionSeed ?? placement?.randomState ?? 0,
    playerEntityId: 'entity-1',
    selectedTargetEntityId: null,
    selectedDestinationSystemId: null,
    lifecycle: {
      ...initializedLifecycle,
      stationSpawnSlots: spatial?.stationSpawnSlots ?? null,
      activeStationVisit: spatial?.activeStationVisit ?? null,
    },
    specialActorSlots: [
      ...(spatial?.stationSpawnSlots ?? [null, ...stations.map(station => station.id)]),
      ...npcs.map(npc => npc.id),
    ],
    // Entry composition captures the real cursor before encounters are created.
    entryActorSlotCount: 0,
    entities: [playerEntity, ...planets, ...stations, ...npcs],
  });
}
