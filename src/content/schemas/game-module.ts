/** Versioned module boundary, including cross-references needed by navigation. */
import { z } from 'zod';
import { UInt32Schema } from '../../random/seeded-random';
import { StartingPlayerSchema } from '../../simulation/model/player-state';
import { GameContentSchema } from './game-content';
import { StarFieldDefinitionSchema } from './star-field';
import { CalendarDateSchema } from '../../simulation/model/entity-components';

const Id = z.string().regex(/^[a-z][a-z0-9-]*$/);
const PositiveId = z.number().int().positive();
const FiniteNumber = z.number().finite();
/** Breaking JSON-contract changes require a new selected module schema. */
export const GAME_MODULE_SCHEMA_VERSION = 6 as const;
// Restrict assets to local module paths: no schemes, traversal, queries, or
// percent-encoded separators. Build tooling supplies the selected public root.
const AssetPath = z.string().regex(/^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:gif|png|jpg|webp|svg)$/);
const AudioAssetPath = z.string().regex(/^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:wav|mp3|ogg)$/);
const NativeSizeSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
}).strict().readonly();
const PivotSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  status: z.enum(['verified', 'provisional']),
}).strict().readonly();
const EntityVisualSchema = z.object({
  entityDefinitionId: PositiveId,
  image: AssetPath,
  nativeSize: NativeSizeSchema,
  pivot: PivotSchema,
}).strict().readonly();
const PlanetVisualSchema = z.object({
  visualTypeId: PositiveId,
  image: AssetPath,
  nativeSize: NativeSizeSchema,
  pivot: PivotSchema,
}).strict().readonly();
const WeaponBeamVisualSchema = z.object({
  weaponDefinitionId: PositiveId,
  image: AssetPath,
  nativeSize: NativeSizeSchema,
  /** Logical symbol bounds before its X axis is stretched to target distance. */
  logicalSize: z.object({
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
  }).strict().readonly(),
  pivot: PivotSchema,
  /** Number of committed simulation frames for which the effect remains visible. */
  durationFrames: z.number().int().positive().max(240),
  /** Legacy target jitter radius in unzoomed world/display units. */
  impactScatterWorldUnits: z.number().finite().nonnegative().max(1000),
}).strict().readonly();

/** Map geometry carries its evidence status into displayed route quotes. */
const MapPositionSchema = z.object({
  x: FiniteNumber, y: FiniteNumber,
  status: z.enum(['authored', 'verified', 'provisional']),
}).strict().readonly().nullable();

const ArrivalSchema = z.object({
  position: z.object({ x: FiniteNumber, y: FiniteNumber }).strict().readonly(),
  rotationDegrees: FiniteNumber,
  speedPerFrame: FiniteNumber.max(0),
  flightMode: z.enum(['impulse', 'warp']),
  status: z.enum(['authored', 'verified', 'provisional']),
}).strict().readonly();

/** A game-authored station placement relative to its system's planet origin. */
const SystemStationSchema = z.object({
  id: Id,
  name: z.string().min(1),
  structureDefinitionId: PositiveId,
  positionOffset: z.object({ x: FiniteNumber, y: FiniteNumber }).strict().readonly(),
  rotationDegrees: FiniteNumber,
  destinationSystemId: PositiveId.nullable(),
}).strict().readonly();

/** One selected NPC definition plus the module-owned encounter policy and seed. */
export const NpcSpawnSchema = z.object({
  shipDefinitionId: PositiveId,
  encounterId: Id,
  seed: UInt32Schema,
  /** One staged merchant offer. The live stock belongs to the spawned NPC. */
  tradeOffer: z.object({ goodsId: Id, label: z.string().min(1), stockTons: z.number().int().positive(), pricePerTon: z.number().int().positive(), currencyId: Id }).strict().readonly().optional(),
}).strict().readonly();

/** Validated world definition used by composition now and travel later. */
export const SystemDefinitionSchema = z.object({
  id: PositiveId,
  name: z.string().min(1),
  governmentId: PositiveId,
  opposingGovernmentId: PositiveId.nullable(),
  initialStrength: z.number().finite().nonnegative(),
  initialPopulationBillions: z.number().finite().nonnegative(),
  priceVariationFactor: FiniteNumber,
  mapPosition: MapPositionSchema,
  /** Spawn state used only after an inter-system transition. */
  arrival: ArrivalSchema,
  planet: z.object({
    /** Local world origin; independent of inter-system map coordinates. */
    placement: z.object({
      position: z.object({ x: FiniteNumber, y: FiniteNumber }).strict().readonly(),
      status: z.enum(['authored', 'provisional']),
    }).strict().readonly(),
    visualTypeId: PositiveId,
    surfaceTypeId: PositiveId,
    description: z.string().min(1),
    displayScalePercent: z.number().finite().positive(),
    hasNebula: z.boolean(),
    hasAsteroids: z.boolean(),
    offeredEntityDefinitionIds: z.tuple([
      PositiveId, PositiveId, PositiveId, PositiveId, PositiveId, PositiveId,
    ]).readonly(),
  }).strict().readonly(),
  stations: z.array(SystemStationSchema).readonly(),
}).strict().readonly();

export type SystemDefinition = z.infer<typeof SystemDefinitionSchema>;

export const GameModuleSchema = z.object({
  schemaVersion: z.literal(GAME_MODULE_SCHEMA_VERSION),
  id: Id,
  version: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string(),
  notice: z.string(),
  framesPerSecond: z.number().finite().positive().max(240),
  calendar: z.object({
    initialDate: CalendarDateSchema,
    daysPerMajor: z.number().int().positive(),
  }).strict().superRefine((calendar, context) => {
    if (calendar.initialDate.minor > calendar.daysPerMajor) {
      context.addIssue({ code: 'custom', path: ['initialDate', 'minor'], message: 'Initial date exceeds the calendar period.' });
    }
  }).readonly(),
  /** Optional additive v4 field; omitted means no decorative background particles. */
  starField: StarFieldDefinitionSchema.optional(),
  viewport: z.object({
    width: z.number().int().positive().max(8192),
    height: z.number().int().positive().max(8192),
    /** Optional logical screen point followed by the player; default is center. */
    cameraAnchor: z.object({ x: FiniteNumber, y: FiniteNumber }).strict().readonly().optional(),
    /** Denominators: 1 is native size; larger values show more of the world. */
    zoom: z.object({
      levels: z.array(z.number().finite().min(1).max(16)).min(1).max(8).readonly(),
      /** Legacy zoom pivot may differ from the player-follow anchor. */
      pivot: z.object({ x: FiniteNumber, y: FiniteNumber }).strict().readonly().optional(),
    }).strict().readonly().optional(),
  }).strict().readonly(),
  content: GameContentSchema,
  resources: z.array(z.object({ id: Id, label: z.string().min(1) }).strict().readonly()).readonly(),
  governments: z.array(z.object({ id: PositiveId, name: z.string().min(1) }).strict().readonly()).min(1).readonly(),
  systems: z.array(SystemDefinitionSchema).min(1).readonly(),
  starts: z.array(z.object({
    id: Id,
    label: z.string().min(1),
    player: StartingPlayerSchema,
    npcSpawn: NpcSpawnSchema.optional(),
  }).strict().readonly()).min(1).readonly(),
  /** Asset manifest kept separate by visual target so numeric legacy IDs cannot collide. */
  visuals: z.object({
    entities: z.array(EntityVisualSchema).min(1).readonly(),
    planets: z.array(PlanetVisualSchema).min(1).readonly(),
    /** Optional additive v5 field; omitted modules have no beam presentation. */
    weaponBeams: z.array(WeaponBeamVisualSchema).readonly().optional().default([]),
  }).strict().readonly(),
  /** Optional selected-scene cue; playback never gates the simulation. */
  audio: z.object({ travel: AudioAssetPath }).strict().readonly().optional(),
}).strict().superRefine((module, context) => {
  const fail = (path: (string | number)[], message: string) => context.addIssue({ code: 'custom', path, message });
  const zoom = module.viewport.zoom;
  if (zoom && (zoom.levels[0] !== 1 || zoom.levels.some((level, index) => index > 0 && level <= zoom.levels[index - 1]!))) {
    fail(['viewport', 'zoom', 'levels'], 'Zoom levels must start at 1 and increase strictly.');
  }
  if (zoom?.pivot && (zoom.pivot.x < 0 || zoom.pivot.x > module.viewport.width
      || zoom.pivot.y < 0 || zoom.pivot.y > module.viewport.height)) {
    fail(['viewport', 'zoom', 'pivot'], 'Zoom pivot must be inside the logical viewport.');
  }
  const unique = (values: readonly (string | number)[], field: string) => {
    if (new Set(values).size !== values.length) fail([field], `${field} IDs must be unique.`);
  };
  unique(module.resources.map(value => value.id), 'resources');
  unique(module.governments.map(value => value.id), 'governments');
  unique(module.systems.map(value => value.id), 'systems');
  unique(module.starts.map(value => value.id), 'starts');
  unique(module.visuals.entities.map(value => value.entityDefinitionId), 'visuals.entities');
  unique(module.visuals.planets.map(value => value.visualTypeId), 'visuals.planets');
  unique(module.visuals.weaponBeams.map(value => value.weaponDefinitionId), 'visuals.weaponBeams');
  const governmentIds = new Set(module.governments.map(government => government.id));
  const systemIds = new Set(module.systems.map(system => system.id));
  const entityDefinitions = module.content.entityDefinitions;
  const stationIds = module.systems.flatMap(system => system.stations.map(station => station.id));
  if (new Set(stationIds).size !== stationIds.length) fail(['systems'], 'Station IDs must be unique across the module.');
  module.systems.forEach((system, systemIndex) => {
    if (!governmentIds.has(system.governmentId)) {
      fail(['systems', systemIndex, 'governmentId'], 'System references an unknown government.');
    }
    if (system.opposingGovernmentId !== null && !governmentIds.has(system.opposingGovernmentId)) {
      fail(['systems', systemIndex, 'opposingGovernmentId'], 'System references an unknown opposing government.');
    }
    if (system.mapPosition && !module.visuals.planets.some(visual => visual.visualTypeId === system.planet.visualTypeId)) {
      fail(['systems', systemIndex, 'planet', 'visualTypeId'], 'Travel destination planet needs a visual.');
    }
    system.planet.offeredEntityDefinitionIds.forEach((entityId, itemIndex) => {
      if (!entityDefinitions.some(entity => entity.id === entityId)) {
        fail(['systems', systemIndex, 'planet', 'offeredEntityDefinitionIds', itemIndex], 'System offers an unknown entity.');
      }
    });
    system.stations.forEach((station, stationIndex) => {
      if (!entityDefinitions.some(entity => entity.id === station.structureDefinitionId && entity.category === 'structure')) {
        fail(['systems', systemIndex, 'stations', stationIndex, 'structureDefinitionId'], 'Station must reference a structure definition.');
      }
      if (station.destinationSystemId !== null && !systemIds.has(station.destinationSystemId)) {
        fail(['systems', systemIndex, 'stations', stationIndex, 'destinationSystemId'], 'Station references an unknown destination system.');
      }
      if (system.mapPosition && !module.visuals.entities.some(visual => visual.entityDefinitionId === station.structureDefinitionId)) {
        fail(['systems', systemIndex, 'stations', stationIndex], 'Travel destination station needs a visual.');
      }
    });
  });
  module.visuals.entities.forEach((visual, index) => {
    if (!module.content.entityDefinitions.some(entity => entity.id === visual.entityDefinitionId)) {
      fail(['visuals', 'entities', index], 'Visual references an unknown entity.');
    }
  });
  module.visuals.weaponBeams.forEach((visual, index) => {
    if (!module.content.weaponDefinitions.some(weapon => weapon.id === visual.weaponDefinitionId)) {
      fail(['visuals', 'weaponBeams', index], 'Beam visual references an unknown weapon.');
    }
  });
  module.starts.forEach((start, index) => {
    const ship = module.content.entityDefinitions.find(entity => entity.id === start.player.entityDefinitionId && entity.category === 'ship');
    if (!ship) fail(['starts', index], 'Start must reference a ship.');
    if (ship && (start.player.hull > ship.maximumHull || start.player.shields > ship.maximumShields)) {
      fail(['starts', index], 'Starting durability exceeds vessel limits.');
    }
    const startingSystem = module.systems.find(system => system.id === start.player.systemId);
    if (!startingSystem) fail(['starts', index], 'Unknown starting system.');
    if (!module.visuals.entities.some(visual => visual.entityDefinitionId === start.player.entityDefinitionId)) {
      fail(['starts', index], 'Starting ship needs a visual.');
    }
    if (start.npcSpawn) {
      if (start.npcSpawn.tradeOffer && !module.resources.some(resource => resource.id === start.npcSpawn!.tradeOffer!.currencyId)) {
        fail(['starts', index, 'npcSpawn', 'tradeOffer', 'currencyId'], 'Trade currency must be a declared resource.');
      }
      if (!entityDefinitions.some(entity => entity.id === start.npcSpawn!.shipDefinitionId && entity.category === 'ship')) {
        fail(['starts', index, 'npcSpawn', 'shipDefinitionId'], 'NPC spawn must reference a ship.');
      }
      if (!module.visuals.entities.some(visual => visual.entityDefinitionId === start.npcSpawn!.shipDefinitionId)) {
        fail(['starts', index, 'npcSpawn', 'shipDefinitionId'], 'NPC spawn needs a visual.');
      }
    }
    if (startingSystem && !module.visuals.planets.some(visual => visual.visualTypeId === startingSystem.planet.visualTypeId)) {
      fail(['starts', index], 'Starting planet needs a visual.');
    }
    startingSystem?.stations.forEach((station, stationIndex) => {
      if (!module.visuals.entities.some(visual => visual.entityDefinitionId === station.structureDefinitionId)) {
        fail(['systems', module.systems.indexOf(startingSystem), 'stations', stationIndex], 'Starting-system station needs a visual.');
      }
    });
    const keys = Object.keys(start.player.resources);
    if (keys.length !== module.resources.length || !module.resources.every(resource => keys.includes(resource.id))) {
      fail(['starts', index, 'player', 'resources'], 'Starting resources must match the declared resource IDs.');
    }
  });
}).readonly();

export type GameModuleDefinition = z.infer<typeof GameModuleSchema>;
