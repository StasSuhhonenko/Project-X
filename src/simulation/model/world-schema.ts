/**
 * Runtime world ownership for the player, planet and system stations.
 *
 * Runtime entity IDs identify instances and never reuse module definition IDs.
 * Coordinates are world units, rotation is clockwise degrees from up, and speed
 * is world units per simulation tick. Additional entity kinds enter this union
 * only when their components are consumed by an implemented feature.
 */
import { z } from 'zod';
import { TradeOfferSchema } from './trade-offer';
import { PlayerIdentitySchema } from './player-identity';
import { StationCombatSchema, NpcGenerationSchema, WorldLifecycleSchema } from './lifecycle-state';
import { UInt32Schema } from '../../random/seeded-random';
import {
  CalendarDateSchema,
  DurabilityComponentSchema,
  InventoryComponentSchema,
  LocationComponentSchema,
  NpcMotionComponentSchema,
  NpcNavigationIntentSchema,
  PlayerConditionComponentSchema,
  PlayerFeedbackComponentSchema,
  PlayerMotionComponentSchema,
  PositiveDefinitionIdSchema,
  RuntimeEntityIdSchema,
  SystemIdSchema,
  StationPlacementIdSchema,
} from './entity-components';

export { RuntimeEntityIdSchema } from './entity-components';

const PlanetEntitySchema = z.object({
  id: RuntimeEntityIdSchema,
  kind: z.literal('planet'),
  location: LocationComponentSchema,
}).strict().readonly();

/** A stationary structure instance; definition and authored placement stay distinct. */
const StationEntitySchema = z.object({
  id: RuntimeEntityIdSchema,
  kind: z.literal('station'),
  stationId: StationPlacementIdSchema,
  combat: StationCombatSchema.nullable().optional().default(null),
  definitionId: PositiveDefinitionIdSchema,
  location: LocationComponentSchema,
}).strict().readonly();

/** Latest accepted command is evidence for replay and later hit resolution. */
const AcceptedShotSchema = z.object({
  sequence: z.number().int().positive(),
  weaponDefinitionId: z.number().int().positive(),
  targetEntityId: RuntimeEntityIdSchema,
  tick: z.number().int().positive(),
}).strict().readonly();

export const PrimaryWeaponStateSchema = z.object({
  weaponDefinitionId: z.number().int().positive().nullable(),
  cooldownRemainingFrames: z.number().finite().nonnegative(),
  shotSequence: z.number().int().nonnegative(),
  /** Highest accepted sequence whose hit was consumed, including misses. */
  resolvedShotSequence: z.number().int().nonnegative(),
  lastAcceptedShot: AcceptedShotSchema.nullable(),
}).strict().readonly();

export type PrimaryWeaponState = z.infer<typeof PrimaryWeaponStateSchema>;

/**
 * Cross-field history contract shared by full restore and focused tick commits.
 * The latest accepted shot belongs to the equipped weapon and cannot come from
 * a later tick. Resolution may lag acceptance (or consume a miss); its sequence
 * can never exceed acceptance. Targets may already have left the world, so this
 * historical evidence deliberately does not require a live target reference.
 * Callers validate field shapes with PrimaryWeaponStateSchema before this check.
 */
export function isPrimaryWeaponHistoryConsistent(armament: PrimaryWeaponState, tick: number): boolean {
  const shot = armament.lastAcceptedShot;
  if ((shot === null) !== (armament.shotSequence === 0)) return false;
  if (armament.resolvedShotSequence > armament.shotSequence) return false;
  if (shot === null) return true;
  return shot.sequence === armament.shotSequence
    && shot.weaponDefinitionId === armament.weaponDefinitionId
    && shot.tick <= tick;
}

const PlayerShipEntitySchema = z.object({
  id: RuntimeEntityIdSchema,
  kind: z.literal('player-ship'),
  /** The single authoritative display identity, independent of definitions. */
  identity: PlayerIdentitySchema.nullable(),
  definitionId: PositiveDefinitionIdSchema,
  location: LocationComponentSchema,
  motion: PlayerMotionComponentSchema,
  condition: PlayerConditionComponentSchema,
  inventory: InventoryComponentSchema,
  armament: PrimaryWeaponStateSchema,
  feedback: PlayerFeedbackComponentSchema,
}).strict().readonly();

/** Mobile non-player ship with engine-validated, module-selected navigation intent. */
const NpcShipEntitySchema = z.object({
  id: RuntimeEntityIdSchema,
  kind: z.literal('npc-ship'),
  definitionId: PositiveDefinitionIdSchema,
  location: LocationComponentSchema,
  motion: NpcMotionComponentSchema,
  condition: DurabilityComponentSchema,
  navigation: NpcNavigationIntentSchema,
  generation: NpcGenerationSchema.nullable().optional().default(null),
  tradeOffer: TradeOfferSchema.nullable(),
}).strict().readonly();

export type PlayerShipEntity = z.infer<typeof PlayerShipEntitySchema>;
export type NpcShipEntity = z.infer<typeof NpcShipEntitySchema>;
export type PlanetEntity = z.infer<typeof PlanetEntitySchema>;
export type StationEntity = z.infer<typeof StationEntitySchema>;
export type WorldEntity = PlayerShipEntity | NpcShipEntity | PlanetEntity | StationEntity;
export type SelectableWorldEntity = NpcShipEntity | StationEntity;

/** The single authoritative eligibility rule for ordinary world selection. */
export function isSelectableWorldEntity(entity: WorldEntity): entity is SelectableWorldEntity {
  return entity.kind === 'station' || entity.kind === 'npc-ship';
}

/** Simulation lifecycle is authoritative; React only presents this state. */
export const WorldStatusSchema = z.enum(['active', 'player-destroyed']);
export type WorldStatus = z.infer<typeof WorldStatusSchema>;

function findEntity(entities: readonly WorldEntity[], id: string): WorldEntity | undefined {
  return entities.find(entity => entity.id === id);
}

export const WorldStateSchema = z.object({
  status: WorldStatusSchema,
  /** Module calendar parts; the travel feature advances them atomically with departure. */
  date: CalendarDateSchema,
  tick: z.number().int().nonnegative(),
  /** Camera zoom denominator selected from the active module's validated levels. */
  cameraZoom: z.number().finite().min(1).max(16),
  nextEntitySequence: z.number().int().positive(),
  /** State of the scenario's deterministic random stream, owned by simulation. */
  randomState: UInt32Schema,
  playerEntityId: RuntimeEntityIdSchema,
  /** One selectable target ID, independent of sprite references or clip paths. */
  selectedTargetEntityId: RuntimeEntityIdSchema.nullable(),
  /** Selected route destination; a module-content ID, never a runtime entity. */
  selectedDestinationSystemId: SystemIdSchema.nullable(),
  lifecycle: WorldLifecycleSchema,
  entities: z.array(z.discriminatedUnion('kind', [PlayerShipEntitySchema, PlanetEntitySchema, StationEntitySchema, NpcShipEntitySchema])).min(1).readonly(),
}).strict().superRefine((world, context) => {
  const ids = world.entities.map(entity => entity.id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: 'custom', path: ['entities'], message: 'Runtime entity IDs must be unique.' });
  }
  const players = world.entities.filter(entity => entity.kind === 'player-ship');
  if (players.length !== 1 || players[0]?.id !== world.playerEntityId) {
    context.addIssue({ code: 'custom', path: ['playerEntityId'], message: 'Player entity ID must resolve in the world.' });
  }
  const playerHull = players[0]?.condition.hull;
  if ((world.status === 'active' && playerHull === 0)
    || (world.status === 'player-destroyed' && playerHull !== 0)) {
    context.addIssue({
      code: 'custom', path: ['status'],
      message: 'World status and player hull must describe the same lifecycle state.',
    });
  }
  const weaponState = players[0]?.armament;
  if (weaponState && !isPrimaryWeaponHistoryConsistent(weaponState, world.tick)) {
    context.addIssue({ code: 'custom', path: ['entities'], message: 'Primary weapon shot history is inconsistent.' });
  }
  const selectedTarget = world.selectedTargetEntityId === null
    ? null : findEntity(world.entities, world.selectedTargetEntityId);
  if (world.selectedTargetEntityId !== null && (!selectedTarget || !isSelectableWorldEntity(selectedTarget))) {
    context.addIssue({ code: 'custom', path: ['selectedTargetEntityId'], message: 'Selected target must resolve to a selectable entity.' });
  }
  if (world.selectedDestinationSystemId === players[0]?.location.systemId) {
    context.addIssue({ code: 'custom', path: ['selectedDestinationSystemId'], message: 'Current system cannot be a travel destination.' });
  }
  const planets = world.entities.filter(entity => entity.kind === 'planet');
  if (planets.length > 1 || planets.some(planet => planet.location.systemId !== players[0]?.location.systemId)) {
    context.addIssue({ code: 'custom', path: ['entities'], message: 'The planet must belong to the active system and be unique.' });
  }
  const stations = world.entities.filter(entity => entity.kind === 'station');
  if (stations.some(station => station.location.systemId !== players[0]?.location.systemId)) {
    context.addIssue({ code: 'custom', path: ['entities'], message: 'Stations must belong to the active system.' });
  }
  if (new Set(stations.map(station => station.stationId)).size !== stations.length) {
    context.addIssue({ code: 'custom', path: ['entities'], message: 'Station placements must have unique IDs.' });
  }
  if (world.entities.some(entity => {
    if (entity.kind !== 'npc-ship') return false;
    if (entity.navigation.targetEntityId === null) return false;
    const target = findEntity(world.entities, entity.navigation.targetEntityId);
    return entity.location.systemId !== players[0]?.location.systemId
      || !target
      || target.id === entity.id
      || target.location.systemId !== entity.location.systemId;
  })) {
    context.addIssue({ code: 'custom', path: ['entities'], message: 'NPC navigation targets must resolve in the active system.' });
  }
  if (world.entities.some(entity => entity.kind === 'npc-ship' && entity.condition.hull === 0)) {
    context.addIssue({ code: 'custom', path: ['entities'], message: 'Destroyed NPCs must be settled before publication.' });
  }
  const allocatedSequences = ids.map(id => Number(id.slice('entity-'.length)));
  const slots = world.lifecycle.stationSpawnSlots;
  if (slots) {
    const references = slots.filter((id): id is string => id !== null);
    if (slots.length === 0 || slots[0] !== null || new Set(references).size !== references.length
        || references.some(id => !stations.some(station => station.id === id)))
      context.addIssue({ code: 'custom', path: ['lifecycle', 'stationSpawnSlots'], message: 'Spawn slots must reference unique active stations.' });
  }
  if (allocatedSequences.some(sequence => sequence >= world.nextEntitySequence)) {
    context.addIssue({ code: 'custom', path: ['nextEntitySequence'], message: 'Next entity sequence must exceed every allocated ID.' });
  }
}).readonly();

export type WorldState = z.infer<typeof WorldStateSchema>;

function freezeEntity(entity: WorldState['entities'][number]): WorldState['entities'][number] {
  Object.freeze(entity.location.position);
  Object.freeze(entity.location);
  if (entity.kind === 'npc-ship') {
    if (entity.generation) Object.freeze(entity.generation);
    Object.freeze(entity.motion);
    Object.freeze(entity.condition);
    Object.freeze(entity.navigation.targetOffset);
    Object.freeze(entity.navigation);
    if (entity.tradeOffer) Object.freeze(entity.tradeOffer);
    return Object.freeze(entity);
  }
  if (entity.kind === 'station' && entity.combat) Object.freeze(entity.combat);
  if (entity.kind !== 'player-ship') return Object.freeze(entity);
  if (entity.identity) Object.freeze(entity.identity);
  Object.freeze(entity.motion);
  Object.freeze(entity.condition);
  Object.freeze(entity.inventory.resources);
  Object.freeze(entity.inventory.cargo);
  Object.freeze(entity.inventory);
  if (entity.armament.lastAcceptedShot) Object.freeze(entity.armament.lastAcceptedShot);
  Object.freeze(entity.armament);
  if (entity.feedback.communication) Object.freeze(entity.feedback.communication);
  if (entity.feedback.notice) Object.freeze(entity.feedback.notice);
  Object.freeze(entity.feedback);
  return Object.freeze(entity);
}

/** Internal publication helper for already validated focused transitions.
 * External construction/restore must use parseWorldState instead.
 */
export function freezeWorld(world: WorldState): WorldState {
  const visit = world.lifecycle.activeStationVisit;
  if (visit) {
    visit.entryMembershipOverrides.forEach(Object.freeze);
    Object.freeze(visit.entryMembershipOverrides);
    Object.freeze(visit.settledStationRecordIds);
    Object.freeze(visit);
  }
  world.lifecycle.stationMembershipOverrides.forEach(Object.freeze);
  world.lifecycle.systemStanding.forEach(Object.freeze);
  world.lifecycle.systemStrength.forEach(Object.freeze);
  Object.freeze(world.lifecycle.systemStrength);
  Object.freeze(world.lifecycle.stationMembershipOverrides);
  Object.freeze(world.lifecycle.systemStanding);
  if (world.lifecycle.stationSpawnSlots) Object.freeze(world.lifecycle.stationSpawnSlots);
  Object.freeze(world.lifecycle);
  world.entities.forEach(freezeEntity);
  Object.freeze(world.entities);
  return Object.freeze(world);
}

/** Validate and deeply freeze a newly constructed or restored world boundary. */
export function parseWorldState(input: unknown): WorldState {
  return freezeWorld(WorldStateSchema.parse(input));
}

