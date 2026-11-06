/** Versioned module boundary, including cross-references needed by navigation. */
import { z } from 'zod';
import { UInt32Schema } from '../../random/seeded-random';
import { CommerceDefinitionSchema } from '../../simulation/contracts/cargo-trade';
import { CombatGeometrySchema } from '../../simulation/geometry/combat-geometry';
import { CalendarDateSchema } from '../../simulation/model/entity-components';
import { hasExactStandingScope } from '../../simulation/model/lifecycle-state';
import { StartingPlayerSchema } from '../../simulation/model/player-state';
import { TradeOfferSchema } from '../../simulation/model/trade-offer';
import { GameContentSchema } from './game-content';
import { LifecycleDefinitionSchema, SystemStandingSchema } from './lifecycle-content';

const Id = z.string().regex(/^[a-z][a-z0-9-]*$/);
const PositiveId = z.number().int().positive();
const FiniteNumber = z.number().finite();
export const GAME_MODULE_SCHEMA_VERSION = 21 as const;
const AudioAssetPath = z.string().regex(/^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:wav|mp3|ogg)$/);

/** Map geometry carries its evidence status into displayed route quotes. */
const MapPositionSchema = z
  .object({
    x: FiniteNumber,
    y: FiniteNumber,
    status: z.enum(['authored', 'verified', 'provisional']),
  })
  .strict()
  .readonly()
  .nullable();

const ArrivalSchema = z
  .object({
    position: z.object({ x: FiniteNumber, y: FiniteNumber }).strict().readonly(),
    rotationDegrees: FiniteNumber,
    speedPerFrame: FiniteNumber.max(0),
    flightMode: z.enum(['impulse', 'warp']),
    status: z.enum(['authored', 'verified', 'provisional']),
  })
  .strict()
  .readonly();

/** A game-authored station placement relative to its system's planet origin. */
const SystemStationSchema = z
  .object({
    commodityMarketSlots: z.array(z.number().int().min(0).max(5)).max(6).readonly().optional(),
    equipmentOffers: z.array(PositiveId.nullable()).length(6).readonly().optional(),
    id: Id,
    name: z.string().min(1),
    structureDefinitionId: PositiveId,
    positionOffset: z.object({ x: FiniteNumber, y: FiniteNumber }).strict().readonly(),
    rotationDegrees: FiniteNumber,
    destinationSystemId: PositiveId.nullable(),
  })
  .strict()
  .readonly();

/** One selected NPC definition plus the module-owned encounter policy and seed. */
export const NpcSpawnSchema = z
  .object({
    shipDefinitionId: PositiveId,
    encounterId: Id,
    seed: UInt32Schema,
    /** One staged merchant offer. The live stock belongs to the spawned NPC. */
    tradeOffer: TradeOfferSchema.unwrap().extend({ stockTons: z.number().int().positive() }).readonly().optional(),
  })
  .strict()
  .readonly();

/** Validated world definition used by composition now and travel later. */
export const SystemDefinitionSchema = z
  .object({
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
    planet: z
      .object({
        /** Local world origin; independent of inter-system map coordinates. */
        placement: z
          .object({
            position: z.object({ x: FiniteNumber, y: FiniteNumber }).strict().readonly(),
            status: z.enum(['authored', 'provisional']),
          })
          .strict()
          .readonly(),
        visualTypeId: PositiveId,
        surfaceTypeId: PositiveId,
        description: z.string().min(1),
        displayScalePercent: z.number().finite().positive(),
        hasNebula: z.boolean(),
        hasAsteroids: z.boolean(),
        /** Six positional offer slots. Null is an empty slot, never a definition ID;
         * preserve its index when presenting the remaining offers. */
        offeredEntityDefinitionIds: z
          .tuple([
            PositiveId.nullable(),
            PositiveId.nullable(),
            PositiveId.nullable(),
            PositiveId.nullable(),
            PositiveId.nullable(),
            PositiveId.nullable(),
          ])
          .readonly(),
      })
      .strict()
      .readonly(),
    stations: z.array(SystemStationSchema).readonly(),
  })
  .strict()
  .readonly();

export type SystemDefinition = z.infer<typeof SystemDefinitionSchema>;

export const GameModuleSchema = z
  .object({
    commerce: CommerceDefinitionSchema.optional(),
    schemaVersion: z.literal(GAME_MODULE_SCHEMA_VERSION),
    id: Id,
    version: z.string().min(1),
    title: z.string().min(1),
    subtitle: z.string(),
    notice: z.string(),
    framesPerSecond: z.number().finite().positive().max(240),
    calendar: z
      .object({
        initialDate: CalendarDateSchema,
        daysPerMajor: z.number().int().positive(),
      })
      .strict()
      .superRefine((calendar, context) => {
        if (calendar.initialDate.minor > calendar.daysPerMajor) {
          context.addIssue({
            code: 'custom',
            path: ['initialDate', 'minor'],
            message: 'Initial date exceeds the calendar period.',
          });
        }
      })
      .readonly(),
    viewport: z
      .object({ width: z.number().int().positive().max(8192), height: z.number().int().positive().max(8192) })
      .strict()
      .readonly(),
    gameplayZoomLevels: z.array(FiniteNumber.min(1).max(16)).min(1).max(8).readonly(),
    combatGeometry: CombatGeometrySchema,
    equipment: z
      .object({
        inventoryCapacity: z.number().int().min(3).max(64),
        supportedWeaponIds: z.array(PositiveId).min(1).readonly(),
        technologyWeaponIds: z.array(PositiveId).readonly(),
      })
      .strict()
      .readonly()
      .optional(),
    content: GameContentSchema,
    resources: z
      .array(
        z
          .object({ id: Id, label: z.string().min(1) })
          .strict()
          .readonly()
      )
      .readonly(),
    governments: z
      .array(
        z
          .object({ id: PositiveId, name: z.string().min(1) })
          .strict()
          .readonly()
      )
      .min(1)
      .readonly(),
    systems: z.array(SystemDefinitionSchema).min(1).readonly(),
    lifecycle: LifecycleDefinitionSchema.optional(),
    starts: z
      .array(
        z
          .object({
            id: Id,
            label: z.string().min(1),
            player: StartingPlayerSchema,
            npcSpawn: NpcSpawnSchema.optional(),
            systemStandingDefaults: z.array(SystemStandingSchema).readonly().optional(),
          })
          .strict()
          .readonly()
      )
      .min(1)
      .readonly(),
    /** Optional selected-scene cue; playback never gates the simulation. */
    audio: z
      .object({ travel: AudioAssetPath, communication: AudioAssetPath.optional() })
      .strict()
      .readonly()
      .optional(),
  })
  .strict()
  .superRefine((module, context) => {
    const equipment = module.equipment;
    if (
      equipment &&
      (new Set(equipment.supportedWeaponIds).size !== equipment.supportedWeaponIds.length ||
        new Set(equipment.technologyWeaponIds).size !== equipment.technologyWeaponIds.length ||
        equipment.technologyWeaponIds.some(id => !equipment.supportedWeaponIds.includes(id)) ||
        [...equipment.supportedWeaponIds, ...equipment.technologyWeaponIds].some(
          id => !module.content.weaponDefinitions.some(w => w.id === id)
        ))
    )
      context.addIssue({ code: 'custom', path: ['equipment'], message: 'Invalid equipment definition references.' });
    module.systems.forEach(system =>
      system.stations.forEach(station => {
        if (station.equipmentOffers?.some(id => id !== null && !equipment?.supportedWeaponIds.includes(id)))
          context.addIssue({ code: 'custom', path: ['systems'], message: 'Unsupported station equipment offer.' });
      })
    );

    const fail = (path: (string | number)[], message: string) => context.addIssue({ code: 'custom', path, message });
    const goods = module.commerce?.goods ?? [];
    if (new Set(goods.map(goods => goods.id)).size !== goods.length)
      fail(['commerce'], 'Commodity IDs must be unique.');
    module.systems.forEach(system =>
      system.stations.forEach(station => {
        const slots = station.commodityMarketSlots ?? [];
        if (new Set(slots).size !== slots.length || (slots.length > 0 && !module.commerce))
          fail(['systems'], 'Invalid station commodity market positions.');
      })
    );
    if (
      module.gameplayZoomLevels[0] !== 1 ||
      module.gameplayZoomLevels.some((value, index) => index > 0 && value <= module.gameplayZoomLevels[index - 1]!)
    )
      fail(['gameplayZoomLevels'], 'Gameplay zoom levels must begin at one and increase strictly.');
    const unique = (values: readonly (string | number)[], field: string) => {
      if (new Set(values).size !== values.length) fail([field], `${field} IDs must be unique.`);
    };
    unique(
      module.resources.map(value => value.id),
      'resources'
    );
    unique(
      module.governments.map(value => value.id),
      'governments'
    );
    unique(
      module.systems.map(value => value.id),
      'systems'
    );
    unique(
      module.starts.map(value => value.id),
      'starts'
    );
    const governmentIds = new Set(module.governments.map(government => government.id));
    const systemIds = new Set(module.systems.map(system => system.id));
    const entityDefinitions = module.content.entityDefinitions;
    const stationIds = module.systems.flatMap(system => system.stations.map(station => station.id));
    const lifecycle = module.lifecycle;
    if (lifecycle) {
      unique(
        lifecycle.stationRecords.map(record => record.id),
        'lifecycle.stationRecords'
      );
      unique(
        lifecycle.stationRecords.map(record => record.stationPlacementId),
        'lifecycle.stationPlacements'
      );
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
        if (
          !system?.stations.some(
            station =>
              station.id === record.stationPlacementId && station.structureDefinitionId === record.structureDefinitionId
          )
        )
          fail(['lifecycle', 'stationRecords', index], 'Lifecycle record must resolve to its authored station.');
      });
      if (lifecycle.mutableStationRecordIds.some(id => !lifecycle.stationRecords.some(record => record.id === id)))
        fail(['lifecycle', 'mutableStationRecordIds'], 'Mutable station record is unavailable.');
      // Standing scopes are explicit consumed identities, including offscreen
      // systems. Spatial destinations and mutable strength still require systems.
      lifecycle.spawnShipDefinitionIds.forEach(id => {
        if (!entityDefinitions.some(entity => entity.id === id && entity.category === 'ship'))
          fail(['lifecycle', 'spawnShipDefinitionIds'], 'Generated ship requires a ship definition.');
      });
      // A captured slot roster represents an entire system's authored station order.
      const lifecycleSystems = new Set(lifecycle.stationRecords.map(record => record.homeSystemId));
      module.systems
        .filter(system => lifecycleSystems.has(system.id))
        .forEach(system => {
          if (
            system.stations.some(
              station => !lifecycle.stationRecords.some(record => record.stationPlacementId === station.id)
            )
          )
            fail(['lifecycle', 'stationRecords'], 'Lifecycle systems require their complete staged station roster.');
        });
    }
    if (new Set(stationIds).size !== stationIds.length)
      fail(['systems'], 'Station IDs must be unique across the module.');
    module.systems.forEach((system, systemIndex) => {
      if (system.governmentId !== null && !governmentIds.has(system.governmentId)) {
        fail(['systems', systemIndex, 'governmentId'], 'System references an unknown government.');
      }
      if (system.opposingGovernmentId !== null && !governmentIds.has(system.opposingGovernmentId)) {
        fail(['systems', systemIndex, 'opposingGovernmentId'], 'System references an unknown opposing government.');
      }
      system.planet.offeredEntityDefinitionIds.forEach((entityId, itemIndex) => {
        if (entityId === null) return;
        if (!entityDefinitions.some(entity => entity.id === entityId)) {
          fail(
            ['systems', systemIndex, 'planet', 'offeredEntityDefinitionIds', itemIndex],
            'System offers an unknown entity.'
          );
        }
      });
      system.stations.forEach((station, stationIndex) => {
        if (
          !entityDefinitions.some(
            entity => entity.id === station.structureDefinitionId && entity.category === 'structure'
          )
        ) {
          fail(
            ['systems', systemIndex, 'stations', stationIndex, 'structureDefinitionId'],
            'Station must reference a structure definition.'
          );
        }
        if (station.destinationSystemId !== null && !systemIds.has(station.destinationSystemId)) {
          fail(
            ['systems', systemIndex, 'stations', stationIndex, 'destinationSystemId'],
            'Station references an unknown destination system.'
          );
        }
      });
    });
    module.starts.forEach((start, index) => {
      const standing = start.systemStandingDefaults ?? [];
      if (!hasExactStandingScope(standing, lifecycle?.standingSystemIds ?? []))
        fail(['starts', index, 'systemStandingDefaults'], 'Start standing must match lifecycle standing systems.');
      const ship = module.content.entityDefinitions.find(
        entity => entity.id === start.player.entityDefinitionId && entity.category === 'ship'
      );
      if (!ship) fail(['starts', index], 'Start must reference a ship.');
      if (ship && (start.player.hull > ship.maximumHull || start.player.shields > ship.maximumShields)) {
        fail(['starts', index], 'Starting durability exceeds vessel limits.');
      }
      const startingSystem = module.systems.find(system => system.id === start.player.systemId);
      if (!startingSystem) fail(['starts', index], 'Unknown starting system.');
      if (start.npcSpawn) {
        if (
          start.npcSpawn.tradeOffer &&
          !module.resources.some(resource => resource.id === start.npcSpawn!.tradeOffer!.currencyId)
        ) {
          fail(
            ['starts', index, 'npcSpawn', 'tradeOffer', 'currencyId'],
            'Trade currency must be a declared resource.'
          );
        }
        if (
          !entityDefinitions.some(
            entity => entity.id === start.npcSpawn!.shipDefinitionId && entity.category === 'ship'
          )
        ) {
          fail(['starts', index, 'npcSpawn', 'shipDefinitionId'], 'NPC spawn must reference a ship.');
        }
      }
      const keys = Object.keys(start.player.resources);
      if (keys.length !== module.resources.length || !module.resources.every(resource => keys.includes(resource.id)))
        fail(['starts', index, 'player', 'resources'], 'Starting resources must match the declared resource IDs.');
    });
    const geometry = module.combatGeometry;
    if (
      geometry.entities.some(item => !entityDefinitions.some(entity => entity.id === item.entityDefinitionId)) ||
      geometry.projectiles.some(
        item => !module.content.weaponDefinitions.some(weapon => weapon.id === item.weaponDefinitionId)
      )
    )
      fail(['combatGeometry'], 'Combat geometry references an unknown definition.');
    const required = [
      ...module.starts.map(start => start.player.entityDefinitionId),
      ...module.starts.flatMap(start => (start.npcSpawn ? [start.npcSpawn.shipDefinitionId] : [])),
      ...module.systems.flatMap(system => system.stations.map(station => station.structureDefinitionId)),
      ...(lifecycle?.spawnShipDefinitionIds ?? []),
    ];
    if (required.some(id => !geometry.entities.some(item => item.entityDefinitionId === id)))
      fail(['combatGeometry'], 'Reachable actors require authoritative local geometry.');
  })
  .readonly();

export type GameModuleDefinition = z.infer<typeof GameModuleSchema>;
