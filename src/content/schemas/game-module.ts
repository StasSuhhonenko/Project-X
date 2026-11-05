/** Versioned module boundary, including cross-references needed by navigation. */
import { z } from 'zod';
import { TradeOfferSchema } from '../../simulation/model/trade-offer';
import { UInt32Schema } from '../../random/seeded-random';
import { StartingPlayerSchema } from '../../simulation/model/player-state';
import { GameContentSchema } from './game-content';
import { StarFieldDefinitionSchema } from './star-field';
import { CalendarDateSchema } from '../../simulation/model/entity-components';
import { LifecycleDefinitionSchema, SystemStandingSchema } from './lifecycle-content';
import { hasExactStandingScope } from '../../simulation/model/lifecycle-state';

const Id = z.string().regex(/^[a-z][a-z0-9-]*$/);
const PositiveId = z.number().int().positive();
const FiniteNumber = z.number().finite();
/** Breaking JSON-contract changes require a new selected module schema. */
export const GAME_MODULE_SCHEMA_VERSION = 19 as const;
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
  /** Uniform bitmap-to-world multiplier; omitted means native pixel size. */
  scale: z.number().finite().positive().optional(),
  /** Additional per-axis bitmap multiplier. Omission preserves uniform scale;
   * dimensions and pivots still describe the same unmodified source bitmap. */
  axisScale: z.object({
    x: z.number().finite().positive(),
    y: z.number().finite().positive(),
  }).strict().readonly().optional(),
  /** Additional uniform multiplier only while this ship is the player.
   * NPCs retain the base scale; omission means one. This changes artwork only. */
  playerScale: z.number().finite().positive().optional(),
  pivot: PivotSchema,
}).strict().superRefine((visual, context) => {
  // Finite inputs can still overflow when multiplied. Reject that content
  // before sprites, pointer bounds or spatial read models receive invalid sizes.
  const worldLengths = [
    visual.nativeSize.width * (visual.axisScale?.x ?? 1),
    visual.nativeSize.height * (visual.axisScale?.y ?? 1),
  ].map(length => length * (visual.scale ?? 1));
  if (!worldLengths.every(length => Number.isFinite(length) && length > 0)) {
    context.addIssue({ code: 'custom', path: ['scale'], message: 'Scaled entity dimensions must remain finite.' });
  }
  if (!worldLengths.every(length => {
    const playerLength = length * (visual.playerScale ?? 1);
    return Number.isFinite(playerLength) && playerLength > 0;
  })) {
    context.addIssue({ code: 'custom', path: ['playerScale'], message: 'Player dimensions must remain finite and positive.' });
  }
}).readonly();
const PlanetVisualSchema = z.object({
  visualTypeId: PositiveId,
  image: AssetPath,
  nativeSize: NativeSizeSchema,
  pivot: PivotSchema,
}).strict().readonly();
const BeamBitmapLayerSchema = z.object({
  image: AssetPath,
  nativeSize: NativeSizeSchema,
  /** Authored bitmap-to-beam transform; linear terms are unitless and the
   * final pair is logical pixels before the parent's distance/zoom scaling. */
  bitmapTransform: z.tuple([FiniteNumber, FiniteNumber, FiniteNumber, FiniteNumber, FiniteNumber, FiniteNumber]).readonly(),
}).strict().readonly();
/** A bitmap layer can spin about its original registration rather than its
 * padded image origin. Bounds retain fractional source crop/stroke dimensions
 * when an SVG's integer canvas has transparent padding. */
const SpecialBitmapLayerSchema = BeamBitmapLayerSchema.unwrap().extend({
  bounds: z.object({
    left: FiniteNumber, top: FiniteNumber, right: FiniteNumber, bottom: FiniteNumber,
  }).strict().superRefine((bounds, context) => {
    if (bounds.right <= bounds.left || bounds.bottom <= bounds.top) {
      context.addIssue({ code: 'custom', message: 'Bitmap bounds must have positive area.' });
    }
  }).readonly().optional(),
  rotationDegreesPerTick: FiniteNumber.min(-360).max(360).optional(),
  rotationPivot: z.object({ x: FiniteNumber, y: FiniteNumber }).strict().readonly().optional(),
  alphaMultiplier: FiniteNumber.min(0).max(1).optional(),
}).strict().readonly();
const SpecialLayersSchema = z.array(SpecialBitmapLayerSchema).min(1).max(16).readonly();
const SpecialEffectVisualSchema = z.object({
  id: Id,
  kind: z.enum(['pulse', 'tractor']),
  /** Cosmetic endpoint scatter in unzoomed world units; never changes holds. */
  targetScatterWorldUnits: FiniteNumber.nonnegative().max(1000).optional(),
  layers: SpecialLayersSchema,
  /** Optional nested clip transform and concrete per-tick animation. The same
   * immutable age-derived geometry feeds collision and presentation. */
  innerTransform: z.tuple([FiniteNumber, FiniteNumber, FiniteNumber, FiniteNumber, FiniteNumber, FiniteNumber]).readonly().optional(),
  innerAnimation: z.object({
    initialScalePercent: FiniteNumber.nonnegative().max(10000),
    growthPerTick: FiniteNumber.nonnegative().max(1000),
    initialAlphaPercent: FiniteNumber.min(0).max(100),
    fadePerTick: FiniteNumber.nonnegative().max(100),
    minimumAlphaPercent: FiniteNumber.min(0).max(100),
    alphaQuantumPercent: FiniteNumber.min(0).max(100),
    stepEveryTicks: z.number().int().positive().max(240).default(1),
    firstStepAgeTick: z.number().int().nonnegative().max(239).default(1),
    /** Static timeline children may retain hit-test bounds after their alpha
     * becomes invisible; authored dynamic removal is a separate contract. */
    removeBelowAlphaAffectsBounds: z.boolean().default(true),
  }).strict().readonly().optional(),
  frameCycleTicks: z.number().int().positive().max(240).optional(),
  poses: z.array(z.object({
    firstAgeTick: z.number().int().nonnegative().max(239), layers: SpecialLayersSchema,
  }).strict().readonly()).min(1).max(120).readonly().optional(),
}).strict().superRefine((visual, context) => {
  if ((visual.poses === undefined) !== (visual.frameCycleTicks === undefined)) {
    context.addIssue({ code: 'custom', message: 'Special poses require both poses and a cycle.' });
    return;
  }
  const poses = visual.poses;
  const cycle = visual.frameCycleTicks;
  if (poses && cycle !== undefined && (poses[0]?.firstAgeTick !== 0 || poses.some((pose, index) =>
    pose.firstAgeTick >= cycle || (index > 0 && pose.firstAgeTick <= poses[index - 1]!.firstAgeTick)))) {
    context.addIssue({ code: 'custom', message: 'Special poses must start at zero and increase within their cycle.' });
  }
}).readonly();
export type SpecialEffectVisual = z.infer<typeof SpecialEffectVisualSchema>;
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
  /** Optional authored bitmap keyposes, indexed by committed visual age.
   * Omission preserves the original single-image presentation contract. */
  frameCycleTicks: z.number().int().positive().max(240).optional(),
  frames: z.array(z.object({
    firstAgeTick: z.number().int().nonnegative().max(239),
    layers: z.array(BeamBitmapLayerSchema).min(1).max(16).readonly(),
  }).strict().readonly()).min(1).max(120).readonly().optional(),
}).strict().superRefine((visual, context) => {
  if ((visual.frames === undefined) !== (visual.frameCycleTicks === undefined)) {
    context.addIssue({ code: 'custom', message: 'Beam keyposes require both frames and a cycle.' });
    return;
  }
  const frames = visual.frames;
  const cycle = visual.frameCycleTicks;
  if (!frames || cycle === undefined) return;
  if (frames[0]?.firstAgeTick !== 0 || frames.some((frame, index) =>
    frame.firstAgeTick >= cycle || (index > 0 && frame.firstAgeTick <= frames[index - 1]!.firstAgeTick))) {
    context.addIssue({ code: 'custom', message: 'Beam keyposes must start at zero and increase within their cycle.' });
  }
}).readonly();

/** Bitmap registration may lie outside a projectile image. Preserve authored
 * fractions rather than silently recentering narrow streaks. */
const ProjectileImageSchema = z.object({
  image: AssetPath,
  nativeSize: NativeSizeSchema,
  logicalSize: z.object({ width: FiniteNumber.positive(), height: FiniteNumber.positive() }).strict().readonly(),
  pivot: z.object({ x: FiniteNumber, y: FiniteNumber }).strict().readonly(),
}).strict().readonly();
const WeaponProjectileVisualSchema = ProjectileImageSchema.unwrap().extend({
  weaponDefinitionId: PositiveId,
  impactFrames: z.array(ProjectileImageSchema.unwrap().extend({
    firstImpactAgeTicks: z.number().int().nonnegative().max(240),
  }).strict().readonly()).readonly(),
}).strict().superRefine((visual,context) => {
  if (visual.impactFrames.some((frame,index) => index>0 && frame.firstImpactAgeTicks<=visual.impactFrames[index-1]!.firstImpactAgeTicks))
    context.addIssue({code:'custom',message:'Projectile impact frames must increase strictly.'});
}).readonly();

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
  equipmentOffers: z.array(PositiveId.nullable()).length(6).readonly().optional(),
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
  tradeOffer: TradeOfferSchema.unwrap().extend({ stockTons: z.number().int().positive() }).readonly().optional(),
}).strict().readonly();

/** Validated world definition used by composition now and travel later. */
export const SystemDefinitionSchema = z.object({
  id: PositiveId,
  name: z.string().min(1),
  /** No government is distinct from an unknown government reference. */
  governmentId: PositiveId.nullable(),
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
    /** Six positional offer slots. Null is an empty slot, never a definition ID;
     * preserve its index when presenting the remaining offers. */
    offeredEntityDefinitionIds: z.tuple([
      PositiveId.nullable(), PositiveId.nullable(), PositiveId.nullable(),
      PositiveId.nullable(), PositiveId.nullable(), PositiveId.nullable(),
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
  equipment: z.object({
    inventoryCapacity: z.number().int().min(3).max(64),
    supportedWeaponIds: z.array(PositiveId).min(1).readonly(),
    technologyWeaponIds: z.array(PositiveId).readonly(),
  }).strict().readonly().optional(),
  content: GameContentSchema,
  resources: z.array(z.object({ id: Id, label: z.string().min(1) }).strict().readonly()).readonly(),
  governments: z.array(z.object({ id: PositiveId, name: z.string().min(1) }).strict().readonly()).min(1).readonly(),
  systems: z.array(SystemDefinitionSchema).min(1).readonly(),
  lifecycle: LifecycleDefinitionSchema.optional(),
  starts: z.array(z.object({
    id: Id,
    label: z.string().min(1),
    player: StartingPlayerSchema,
    npcSpawn: NpcSpawnSchema.optional(),
    systemStandingDefaults: z.array(SystemStandingSchema).readonly().optional(),
  }).strict().readonly()).min(1).readonly(),
  /** Asset manifest kept separate by visual target so numeric legacy IDs cannot collide. */
  visuals: z.object({
    entities: z.array(EntityVisualSchema).min(1).readonly(),
    planets: z.array(PlanetVisualSchema).min(1).readonly(),
    /** Optional additive v5 field; omitted modules have no beam presentation. */
    weaponBeams: z.array(WeaponBeamVisualSchema).readonly().optional().default([]),
    weaponProjectiles: z.array(WeaponProjectileVisualSchema).readonly().optional().default([]),
    specialEffects: z.array(SpecialEffectVisualSchema).readonly().optional().default([]),
    /** View-only cloak fade; authoritative visibility state belongs to actors. */
    cloak: z.object({
      fadePerTick: FiniteNumber.positive().max(1),
      playerAlpha: FiniteNumber.min(0).max(1),
      npcAlpha: FiniteNumber.min(0).max(1),
    }).strict().readonly().optional(),
  }).strict().readonly(),
  /** Optional selected-scene cue; playback never gates the simulation. */
  audio: z.object({ travel: AudioAssetPath, communication: AudioAssetPath.optional() }).strict().readonly().optional(),
}).strict().superRefine((module, context) => {
  const equipment = module.equipment;
  if (equipment && (new Set(equipment.supportedWeaponIds).size !== equipment.supportedWeaponIds.length
    || new Set(equipment.technologyWeaponIds).size !== equipment.technologyWeaponIds.length
    || equipment.technologyWeaponIds.some(id => !equipment.supportedWeaponIds.includes(id))
    || [...equipment.supportedWeaponIds, ...equipment.technologyWeaponIds].some(id => !module.content.weaponDefinitions.some(w => w.id === id))))
    context.addIssue({ code: 'custom', path: ['equipment'], message: 'Invalid equipment definition references.' });
  module.systems.forEach(system => system.stations.forEach(station => {
    if (station.equipmentOffers?.some(id => id !== null && !equipment?.supportedWeaponIds.includes(id)))
      context.addIssue({ code: 'custom', path: ['systems'], message: 'Unsupported station equipment offer.' });
  }));

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
  unique(module.visuals.weaponProjectiles.map(value => value.weaponDefinitionId), 'visuals.weaponProjectiles');
  unique(module.visuals.specialEffects.map(value => value.id), 'visuals.specialEffects');
  module.visuals.weaponProjectiles.forEach((visual,index) => {
    if (!module.content.weaponDefinitions.some(weapon=>weapon.id===visual.weaponDefinitionId))
      fail(['visuals','weaponProjectiles',index],'Projectile visual references an unknown weapon.');
    if (module.visuals.weaponBeams.some(beam=>beam.weaponDefinitionId===visual.weaponDefinitionId))
      fail(['visuals','weaponProjectiles',index],'A primary weapon cannot have both beam and projectile visuals.');
  });
  const governmentIds = new Set(module.governments.map(government => government.id));
  const systemIds = new Set(module.systems.map(system => system.id));
  const entityDefinitions = module.content.entityDefinitions;
  const stationIds = module.systems.flatMap(system => system.stations.map(station => station.id));
  const lifecycle = module.lifecycle;
  if (lifecycle) {
    unique(lifecycle.stationRecords.map(record => record.id), 'lifecycle.stationRecords');
    unique(lifecycle.stationRecords.map(record => record.stationPlacementId), 'lifecycle.stationPlacements');
    unique(lifecycle.mutableStationRecordIds, 'lifecycle.mutableStationRecordIds');
    unique(lifecycle.standingSystemIds, 'lifecycle.standingSystemIds');
    unique(lifecycle.strengthSystemIds, 'lifecycle.strengthSystemIds');
    if (lifecycle.strengthSystemIds.some(id => !systemIds.has(id)))
      fail(['lifecycle', 'strengthSystemIds'], 'Strength system is unavailable.');
    unique(lifecycle.spawnShipDefinitionIds, 'lifecycle.spawnShipDefinitionIds');
    lifecycle.stationRecords.forEach((record, index) => {
      const system = module.systems.find(candidate => candidate.id === record.homeSystemId);
      // The current lifecycle rule context requires an owning government.
      // Stationless unowned worlds grant no combat or generation capability.
      if (system?.governmentId === null)
        fail(['lifecycle', 'stationRecords', index], 'Station lifecycle requires an owned home system.');
      if (!system?.stations.some(station => station.id === record.stationPlacementId
          && station.structureDefinitionId === record.structureDefinitionId))
        fail(['lifecycle', 'stationRecords', index], 'Lifecycle record must resolve to its authored station.');
    });
    if (lifecycle.mutableStationRecordIds.some(id => !lifecycle.stationRecords.some(record => record.id === id)))
      fail(['lifecycle', 'mutableStationRecordIds'], 'Mutable station record is unavailable.');
    // Standing scopes are explicit consumed identities, including offscreen
    // systems. Spatial destinations and mutable strength still require systems.
    lifecycle.spawnShipDefinitionIds.forEach(id => {
      if (!entityDefinitions.some(entity => entity.id === id && entity.category === 'ship')
          || !module.visuals.entities.some(visual => visual.entityDefinitionId === id))
        fail(['lifecycle', 'spawnShipDefinitionIds'], 'Generated ship requires a ship definition and visual.');
    });
    // A captured slot roster represents an entire system's authored station order.
    const lifecycleSystems = new Set(lifecycle.stationRecords.map(record => record.homeSystemId));
    module.systems.filter(system => lifecycleSystems.has(system.id)).forEach(system => {
      if (system.stations.some(station => !lifecycle.stationRecords.some(record => record.stationPlacementId === station.id)))
        fail(['lifecycle', 'stationRecords'], 'Lifecycle systems require their complete staged station roster.');
    });
  }
  if (new Set(stationIds).size !== stationIds.length) fail(['systems'], 'Station IDs must be unique across the module.');
  module.systems.forEach((system, systemIndex) => {
    if (system.governmentId !== null && !governmentIds.has(system.governmentId)) {
      fail(['systems', systemIndex, 'governmentId'], 'System references an unknown government.');
    }
    if (system.opposingGovernmentId !== null && !governmentIds.has(system.opposingGovernmentId)) {
      fail(['systems', systemIndex, 'opposingGovernmentId'], 'System references an unknown opposing government.');
    }
    if (system.mapPosition && !module.visuals.planets.some(visual => visual.visualTypeId === system.planet.visualTypeId)) {
      fail(['systems', systemIndex, 'planet', 'visualTypeId'], 'Travel destination planet needs a visual.');
    }
    system.planet.offeredEntityDefinitionIds.forEach((entityId, itemIndex) => {
      if (entityId === null) return;
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
    const entity = module.content.entityDefinitions.find(entity => entity.id === visual.entityDefinitionId);
    if (!entity) {
      fail(['visuals', 'entities', index], 'Visual references an unknown entity.');
      return;
    }
    if (visual.playerScale !== undefined && entity.category !== 'ship') {
      fail(['visuals', 'entities', index, 'playerScale'], 'Only ship visuals can specify player scale.');
    }
  });
  module.visuals.weaponBeams.forEach((visual, index) => {
    if (!module.content.weaponDefinitions.some(weapon => weapon.id === visual.weaponDefinitionId)) {
      fail(['visuals', 'weaponBeams', index], 'Beam visual references an unknown weapon.');
    }
  });
  module.starts.forEach((start, index) => {
    const standing = start.systemStandingDefaults ?? [];
    if (!hasExactStandingScope(standing, lifecycle?.standingSystemIds ?? []))
      fail(['starts', index, 'systemStandingDefaults'], 'Start standing must match lifecycle standing systems.');
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
