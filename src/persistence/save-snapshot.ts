import { validateSavedEquipment, supportsSavedLaunch } from './equipment-validation';
/** Versioned, host-neutral save boundary for one completed simulation world. */
import { validateSavedSpecialEffects } from './special-effect-validation';
import { z } from 'zod';
import type { GameModule } from '../content/game-module';
import { GAME_MODULE_SCHEMA_VERSION } from '../content/schemas/game-module';
import { GAME_RULES_API_VERSION } from '../simulation/contracts/game-rules';
import { totalCargoTons } from '../simulation/model/cargo-quantities';
import { validateSavedLifecycle } from './lifecycle-validation';
import { validateSavedEncounters } from './encounter-validation';
import { ProjectileFlightDefinitionSchema } from '../simulation/contracts/projectile-rules';
import { isEarlierRuntimeEntityId } from '../simulation/model/entity-components';
import { parseWorldState, selectPlayerEntity, type WorldState, WorldStateSchema } from '../simulation/model/world-state';

/** Version8 adds owned equipment and independent channels to captured special fields, sparse scan rosters and temporary
 * actor status alongside projectile/visit continuation. Older saves reject. */
export const SAVE_SCHEMA_VERSION = 8 as const;

export const SaveSnapshotSchema = z.object({
  saveSchemaVersion: z.literal(SAVE_SCHEMA_VERSION),
  module: z.object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    version: z.string().min(1),
    schemaVersion: z.literal(GAME_MODULE_SCHEMA_VERSION),
    rulesApiVersion: z.literal(GAME_RULES_API_VERSION),
  }).strict().readonly(),
  startId: z.string().regex(/^[a-z][a-z0-9-]*$/),
  /** Includes cooldown, repair state, tick, allocator and seeded RNG state. */
  world: WorldStateSchema,
}).strict().readonly();

export type SaveSnapshot = z.infer<typeof SaveSnapshotSchema>;

/** Capture a stable world as data, with no store, renderer or browser objects. */
export function createSaveSnapshot(world: WorldState, startId: string, gameModule: GameModule): SaveSnapshot {
  return parseSaveSnapshot({
    saveSchemaVersion: SAVE_SCHEMA_VERSION,
    module: {
      id: gameModule.definition.id,
      version: gameModule.definition.version,
      schemaVersion: gameModule.definition.schemaVersion,
      rulesApiVersion: gameModule.rules.apiVersion,
    },
    startId,
    world,
  }, gameModule);
}

/**
 * Parse untrusted JSON and check module-owned references before publication.
 * Exact module version is the content compatibility policy for v8. Authors
 * must bump that version whenever content or rules affect existing worlds.
 */
export function parseSaveSnapshot(input: unknown, gameModule: GameModule): SaveSnapshot {
  const parsed = SaveSnapshotSchema.parse(input);
  const { definition, catalog, rules } = gameModule;
  if (parsed.module.id !== definition.id || parsed.module.version !== definition.version
      || parsed.module.schemaVersion !== definition.schemaVersion
      || parsed.module.rulesApiVersion !== rules.apiVersion) {
    throw new Error('Save belongs to an incompatible game module or version.');
  }
  const start = definition.starts.find(start => start.id === parsed.startId);
  if (!start) {
    throw new Error('Save references an unavailable starting choice.');
  }
  const world = parseWorldState(parsed.world);
  validateSavedEquipment(world, gameModule);
  validateSavedSpecialEffects(world, gameModule);
  const expectedStationIds = validateSavedLifecycle(world, parsed.startId, gameModule);
  const player = selectPlayerEntity(world);
  const system = definition.systems.find(candidate => candidate.id === player.location.systemId);
  const vessel = catalog.getShipDefinition(player.definitionId);
  world.projectiles.forEach(projectile=>{
    if (projectile.targetEntityId !== null && !isEarlierRuntimeEntityId(projectile.targetEntityId,projectile.id))
      throw Error('Saved projectile target did not exist before emission.');
    const flight=rules.getProjectileFlight?.(projectile.weaponDefinitionId);
    if (!flight || !rules.advanceProjectileMotion || !supportsSavedLaunch(gameModule, projectile.emitterDefinitionId, projectile.weaponDefinitionId)
        || !catalog.getWeaponDefinition(projectile.weaponDefinitionId)
        || !definition.visuals.weaponProjectiles.some(visual=>visual.weaponDefinitionId===projectile.weaponDefinitionId))
      throw Error('Save references an unavailable projectile capability.');
    const spec=ProjectileFlightDefinitionSchema.parse(flight);
    if ((projectile.impactAgeTicks===null && projectile.ageTicks>=spec.maximumAgeTicks)
        || (projectile.impactAgeTicks!==null && (projectile.impactAgeTicks>=spec.impactDurationTicks
          || projectile.ageTicks-projectile.impactAgeTicks>=spec.maximumAgeTicks)))
      throw Error('Saved projectile has already expired.');
    const target=projectile.targetEntityId===null?null:world.entities.find(entity=>entity.id===projectile.targetEntityId);
    if (target && target.kind!=='npc-ship' && target.kind!=='station') throw Error('Saved projectile targets an invalid actor.');
  });
  if (!system || !vessel) throw new Error('Save references an unavailable player vessel or system.');
  if (player.condition.hull > vessel.maximumHull || player.condition.shields > vessel.maximumShields) {
    throw new Error('Saved player durability exceeds vessel limits.');
  }
  const cargoTons = totalCargoTons(player.inventory.cargo);
  if (!Number.isSafeInteger(cargoTons) || cargoTons > vessel.cargoCapacity) {
    throw new Error('Saved cargo exceeds vessel capacity or supported quantity limits.');
  }
  if (world.date.minor > definition.calendar.daysPerMajor) {
    throw new Error('Saved date exceeds the selected module calendar.');
  }
  if (!Number.isSafeInteger(world.tick) || !Number.isSafeInteger(world.nextEntitySequence)) {
    throw new Error('Saved tick or runtime allocator is outside the safe integer range.');
  }
  if (!(definition.viewport.zoom?.levels ?? [1]).includes(world.cameraZoom)) {
    throw new Error('Saved camera zoom is not available in the selected module.');
  }
  const resourceKeys = Object.keys(player.inventory.resources);
  if (resourceKeys.length !== definition.resources.length
      || !definition.resources.every(resource => resourceKeys.includes(resource.id))) {
    throw new Error('Saved player resources do not match the selected module.');
  }
  const weaponId = player.armament.weaponDefinitionId;
  if (weaponId !== null && !catalog.getWeaponDefinition(weaponId)) {
    throw new Error('Save references an unavailable player weapon.');
  }
  if (world.selectedDestinationSystemId !== null
      && !definition.systems.some(candidate => candidate.id === world.selectedDestinationSystemId)) {
    throw new Error('Save references an unavailable destination system.');
  }
  // This slice has exactly one indestructible planet and its authored stations.
  // Validate their identities; ordinary world parsing checks runtime ID links.
  const planets = world.entities.filter(entity => entity.kind === 'planet');
  const stations = world.entities.filter(entity => entity.kind === 'station');
  const expectedStations = system.stations.filter(station => expectedStationIds.includes(station.id));
  if (planets.length !== 1 || stations.length !== expectedStations.length) {
    throw new Error('Saved system composition differs from selected module content.');
  }
  const planet = planets[0]!;
  if (planet.location.rotationDegrees !== 0
      || planet.location.position.x !== system.planet.placement.position.x
      || planet.location.position.y !== system.planet.placement.position.y) {
    throw new Error('Saved planet placement differs from selected module content.');
  }
  if (stations.some(station => !expectedStations.some(authored => (
    authored.id === station.stationId && authored.structureDefinitionId === station.definitionId
    && station.location.rotationDegrees === authored.rotationDegrees
    && station.location.position.x === planet.location.position.x + authored.positionOffset.x
    && station.location.position.y === planet.location.position.y + authored.positionOffset.y
  )))) {
    throw new Error('Save references an unavailable station.');
  }
  const npcs = world.entities.filter(entity => entity.kind === 'npc-ship');
  if (npcs.some(npc => {
    const ship = catalog.getShipDefinition(npc.definitionId);
    if (npc.location.systemId !== system.id || !ship) return true;
    if (npc.condition.hull > ship.maximumHull || npc.condition.shields > ship.maximumShields) return true;
    if (!npc.tradeOffer) return false;
    const currencyId = npc.tradeOffer.currencyId;
    return !definition.resources.some(resource => resource.id === currencyId);
  })) {
    throw new Error('Save references an invalid NPC or merchant balance.');
  }
  validateSavedEncounters(world, start);
  return Object.freeze({
    saveSchemaVersion: SAVE_SCHEMA_VERSION,
    module: Object.freeze({ ...parsed.module }),
    startId: parsed.startId,
    world,
  });
}
