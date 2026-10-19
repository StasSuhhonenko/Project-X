/** Convert one validated module start into the first authoritative component world. */
import { z } from 'zod';
import { NpcSpawnSchema, SystemDefinitionSchema, type SystemDefinition } from '../../content/schemas/game-module';
import type { GameRules } from '../contracts/game-rules';
import { CalendarDateSchema, DurabilityComponentSchema } from './entity-components';
import {
  StartingNpcPlacementSchema,
  freezeNpcTargetState,
} from './npc-state';
import { StartingPlayerSchema, type StartingPlayer } from './player-state';
import {
  parseWorldState,
  type NpcShipEntity,
  type PlanetEntity,
  type PlayerShipEntity,
  type PrimaryWeaponState,
  type StationEntity,
  type WorldState,
} from './world-state';

const InitialPrimaryWeaponSchema = z.object({
  weaponDefinitionId: z.number().int().positive(),
  initialCooldownFrames: z.number().finite().nonnegative(),
}).strict().readonly();

/** The sole adapter from the flat module-start DTO to runtime components. */
function playerToEntity(
  id: string,
  player: StartingPlayer,
  armament: PrimaryWeaponState,
): PlayerShipEntity {
  return {
    id,
    kind: 'player-ship',
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
    inventory: { resources: { ...player.resources }, cargo: {} },
    armament,
    feedback: { notice: player.notice ? { ...player.notice } : null },
  };
}

/** Compose one system's static spatial entities at a fresh runtime ID range. */
export function createSystemSpatialEntities(system: SystemDefinition, firstEntitySequence: number): {
  readonly planet: PlanetEntity;
  readonly stations: readonly StationEntity[];
  readonly nextEntitySequence: number;
} {
  const planet: PlanetEntity = {
    id: `entity-${firstEntitySequence}`, kind: 'planet',
    location: { systemId: system.id, position: { ...system.planet.placement.position }, rotationDegrees: 0 },
  };
  // Station offsets are relative to the planet INSTANCE origin, not map geometry.
  const stations: StationEntity[] = system.stations.map((station, index) => ({
    id: `entity-${firstEntitySequence + index + 1}`,
    kind: 'station', stationId: station.id, definitionId: station.structureDefinitionId,
    location: {
      systemId: system.id,
      position: {
        x: planet.location.position.x + station.positionOffset.x,
        y: planet.location.position.y + station.positionOffset.y,
      },
      rotationDegrees: station.rotationDegrees,
    },
  }));
  return { planet, stations, nextEntitySequence: firstEntitySequence + 1 + stations.length };
}

/** A fresh start assigns player, planet, stations and NPC consecutive runtime IDs. */
export function createStartingWorld(
  initialDateInput: unknown,
  playerInput: unknown,
  systemInput?: unknown,
  npcSpawnInput?: unknown,
  initialPrimaryWeaponInput?: unknown,
  createStartingNpc?: GameRules['createStartingNpc'],
  npcDurabilityInput?: unknown,
): WorldState {
  const date = CalendarDateSchema.parse(initialDateInput);
  const player = StartingPlayerSchema.parse(playerInput);
  const system = systemInput === undefined ? undefined : SystemDefinitionSchema.parse(systemInput);
  const npcSpawn = npcSpawnInput === undefined ? undefined : NpcSpawnSchema.parse(npcSpawnInput);
  const initialPrimaryWeapon = initialPrimaryWeaponInput === undefined ? null
    : InitialPrimaryWeaponSchema.parse(initialPrimaryWeaponInput);
  const npcDurability = npcDurabilityInput === undefined ? null
    : DurabilityComponentSchema.parse(npcDurabilityInput);
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
  const spatial = system ? createSystemSpatialEntities(system, 2) : null;
  const planets = spatial ? [spatial.planet] : [];
  const stations = spatial?.stations ?? [];
  const targetCandidates = [playerEntity, ...planets, ...stations].map(entity => freezeNpcTargetState({
    id: entity.id,
    kind: entity.kind,
    position: entity.location.position,
  }));
  const placement = npcSpawn && createStartingNpc
    ? StartingNpcPlacementSchema.parse(createStartingNpc(Object.freeze({
      encounterId: npcSpawn.encounterId,
      seed: npcSpawn.seed,
      playerPosition: playerEntity.location.position,
      targetCandidates: Object.freeze(targetCandidates),
    })))
    : null;
  if (placement && !targetCandidates.some(candidate => candidate.id === placement.targetEntityId)) {
    throw new Error('Starting NPC target must be an engine-provided candidate.');
  }
  const npcs: NpcShipEntity[] = npcSpawn && placement ? [{
    id: `entity-${spatial!.nextEntitySequence}`, kind: 'npc-ship', definitionId: npcSpawn.shipDefinitionId,
    location: { systemId: player.systemId, position: placement.position, rotationDegrees: 0 },
    motion: { speedPerFrame: 0, desiredSpeedPerFrame: 0 },
    condition: npcDurability!,
    navigation: { targetEntityId: placement.targetEntityId, targetOffset: placement.targetOffset },
    tradeOffer: npcSpawn.tradeOffer ?? null,
  }] : [];
  return parseWorldState({
    status: 'active',
    date,
    tick: 0,
    cameraZoom: 1,
    nextEntitySequence: (spatial?.nextEntitySequence ?? 2) + npcs.length,
    randomState: placement?.randomState ?? 0,
    playerEntityId: 'entity-1',
    selectedTargetEntityId: null,
    selectedDestinationSystemId: null,
    entities: [playerEntity, ...planets, ...stations, ...npcs],
  });
}
