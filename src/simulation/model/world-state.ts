/**
 * Runtime world ownership for the player, planet and system stations.
 *
 * Runtime entity IDs identify instances and never reuse module definition IDs.
 * Coordinates are world units, rotation is clockwise degrees from up, and speed
 * is world units per simulation tick. Additional entity kinds enter this union
 * only when their components are consumed by an implemented feature.
 */
import { z } from 'zod';
import { UInt32Schema, isUInt32 } from '../../random/seeded-random';
import { DestinationSelectionIntentSchema, type DestinationSelectionIntent } from '../commands/destination-selection';
import {
  CargoBalancesSchema,
  CalendarDateSchema,
  DurabilityComponentSchema,
  InventoryComponentSchema,
  LocationComponentSchema,
  NpcMotionComponentSchema,
  NpcNavigationIntentSchema,
  PlayerConditionComponentSchema,
  PlayerFeedbackComponentSchema,
  PlayerNoticeSchema,
  PlayerMotionComponentSchema,
  PositiveDefinitionIdSchema,
  RuntimeEntityIdSchema,
  ResourceBalancesSchema,
  SystemIdSchema,
  StationPlacementIdSchema,
} from './entity-components';
import {
  NpcMovementStateSchema,
  freezeNpcMovementState,
  type NpcMovementState,
} from './npc-state';
import {
  PlayerMovementStateSchema,
  freezePlayerMovementState,
  type PlayerMovementState,
} from './player-state';

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

const PlayerShipEntitySchema = z.object({
  id: RuntimeEntityIdSchema,
  kind: z.literal('player-ship'),
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
  tradeOffer: z.object({ goodsId: z.string().regex(/^[a-z][a-z0-9-]*$/), label: z.string().min(1), stockTons: z.number().int().nonnegative(), pricePerTon: z.number().int().positive(), currencyId: z.string().regex(/^[a-z][a-z0-9-]*$/) }).strict().readonly().nullable(),
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
  /** Module calendar parts; S16 advances them atomically with departure. */
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
  if (weaponState && ((weaponState.lastAcceptedShot === null) !== (weaponState.shotSequence === 0)
    || weaponState.resolvedShotSequence > weaponState.shotSequence
    || (weaponState.lastAcceptedShot !== null && (
      weaponState.lastAcceptedShot.sequence !== weaponState.shotSequence
      || weaponState.lastAcceptedShot.weaponDefinitionId !== weaponState.weaponDefinitionId
      || weaponState.lastAcceptedShot.tick > world.tick
    )))) {
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
  if (allocatedSequences.some(sequence => sequence >= world.nextEntitySequence)) {
    context.addIssue({ code: 'custom', path: ['nextEntitySequence'], message: 'Next entity sequence must exceed every allocated ID.' });
  }
}).readonly();

export type WorldState = z.infer<typeof WorldStateSchema>;

function freezeEntity(entity: WorldState['entities'][number]): WorldState['entities'][number] {
  Object.freeze(entity.location.position);
  Object.freeze(entity.location);
  if (entity.kind === 'npc-ship') {
    Object.freeze(entity.motion);
    Object.freeze(entity.condition);
    Object.freeze(entity.navigation.targetOffset);
    Object.freeze(entity.navigation);
    if (entity.tradeOffer) Object.freeze(entity.tradeOffer);
    return Object.freeze(entity);
  }
  if (entity.kind !== 'player-ship') return Object.freeze(entity);
  Object.freeze(entity.motion);
  Object.freeze(entity.condition);
  Object.freeze(entity.inventory.resources);
  Object.freeze(entity.inventory.cargo);
  Object.freeze(entity.inventory);
  if (entity.armament.lastAcceptedShot) Object.freeze(entity.armament.lastAcceptedShot);
  Object.freeze(entity.armament);
  if (entity.feedback.notice) Object.freeze(entity.feedback.notice);
  Object.freeze(entity.feedback);
  return Object.freeze(entity);
}

function freezeWorld(world: WorldState): WorldState {
  world.entities.forEach(freezeEntity);
  Object.freeze(world.entities);
  return Object.freeze(world);
}

/** Validate and deeply freeze a newly constructed or restored world boundary. */
export function parseWorldState(input: unknown): WorldState {
  return freezeWorld(WorldStateSchema.parse(input));
}

export interface PlayerRepairStateUpdate {
  readonly hull: number;
  readonly shields: number;
  readonly repairing: boolean;
  readonly resources: Readonly<Record<string, number>>;
  readonly notice: z.infer<typeof PlayerNoticeSchema> | null;
}

/**
 * Commit one validated repair command/progress result without advancing time.
 * Eligibility, payment and monotonic healing are owned by the repair feature;
 * this narrow state boundary prevents callers from replacing unrelated fields.
 */
export function commitPlayerRepairState(world: WorldState, input: PlayerRepairStateUpdate): WorldState {
  if (world.status !== 'active') throw new Error('Cannot repair a destroyed player.');
  const durability = DurabilityComponentSchema.parse({ hull: input.hull, shields: input.shields });
  const repairing = z.boolean().parse(input.repairing);
  const resources = ResourceBalancesSchema.parse(input.resources);
  const notice = PlayerNoticeSchema.nullable().parse(input.notice);
  return parseWorldState({
    ...world,
    entities: world.entities.map(entity => entity.kind !== 'player-ship' ? entity : {
      ...entity,
      condition: { ...entity.condition, ...durability, repairing },
      inventory: { ...entity.inventory, resources },
      feedback: { notice },
    }),
  });
}

/** Commit an already quoted quantity, checking payment, capacity and stock again. */
export function commitTradePurchase(world: WorldState, npcId: string, quantityTons: number, cargoCapacityTons: number): WorldState {
  if (world.status !== 'active') throw new Error('Cannot trade in a terminal world.');
  const npc = selectWorldEntity(world, npcId);
  if (!npc || npc.kind !== 'npc-ship' || !npc.tradeOffer) throw new Error('Merchant is unavailable.');
  if (world.selectedTargetEntityId !== npcId) throw new Error('Merchant is not selected.');
  if (!Number.isSafeInteger(quantityTons) || quantityTons <= 0 || quantityTons > npc.tradeOffer.stockTons) throw new Error('Invalid merchant stock quantity.');
  const player = selectPlayerEntity(world);
  const occupiedTons = Object.values(player.inventory.cargo).reduce((sum, tons) => sum + tons, 0);
  if (!Number.isFinite(cargoCapacityTons) || occupiedTons + quantityTons > cargoCapacityTons) throw new Error('Insufficient cargo capacity.');
  const { goodsId, currencyId, pricePerTon } = npc.tradeOffer;
  const totalPrice = quantityTons * pricePerTon;
  if (!Number.isSafeInteger(totalPrice) || (player.inventory.resources[currencyId] ?? -1) < totalPrice) throw new Error('Insufficient trade currency.');
  const resources = ResourceBalancesSchema.parse({ ...player.inventory.resources, [currencyId]: player.inventory.resources[currencyId]! - totalPrice });
  const cargo = CargoBalancesSchema.parse({ ...player.inventory.cargo, [goodsId]: (player.inventory.cargo[goodsId] ?? 0) + quantityTons });
  return parseWorldState({ ...world, entities: world.entities.map(entity => {
    if (entity.id === world.playerEntityId && entity.kind === 'player-ship') return { ...entity, inventory: { resources, cargo } };
    if (entity.id === npcId && entity.kind === 'npc-ship') return { ...entity, tradeOffer: { ...entity.tradeOffer!, stockTons: entity.tradeOffer!.stockTons - quantityTons } };
    return entity;
  }) });
}

/** Return the stable frozen entity reference for focused UI component selectors. */
export function selectPlayerEntity(world: WorldState): PlayerShipEntity {
  const entity = selectWorldEntity(world, world.playerEntityId);
  if (!entity || entity.kind !== 'player-ship') throw new Error(`Missing player entity ${world.playerEntityId}.`);
  return entity;
}

/** Resolve one runtime identity without exposing mutation or presentation state. */
export function selectWorldEntity(world: WorldState, entityId: string): WorldEntity | undefined {
  return findEntity(world.entities, entityId);
}

/** Return the selectable entities used by validation, hit testing and panels. */
export function selectSelectableWorldEntities(world: WorldState): readonly SelectableWorldEntity[] {
  return world.entities.filter(isSelectableWorldEntity);
}

/** Resolve the world-owned selection through the same eligibility authority. */
export function selectSelectedWorldTarget(world: WorldState): SelectableWorldEntity | null {
  if (world.selectedTargetEntityId === null) return null;
  const target = selectWorldEntity(world, world.selectedTargetEntityId);
  if (!target || !isSelectableWorldEntity(target)) {
    throw new Error('Selected target does not resolve to a selectable entity.');
  }
  return target;
}

/** Project only the fields navigation and primary-fire eligibility consume. */
export function selectPlayerMovementState(world: WorldState): PlayerMovementState {
  const entity = selectPlayerEntity(world);
  return freezePlayerMovementState({
    position: entity.location.position,
    rotationDegrees: entity.location.rotationDegrees,
    speedPerFrame: entity.motion.speedPerFrame,
    flightMode: entity.motion.flightMode,
    energy: entity.condition.energy,
    notice: entity.feedback.notice,
    repairing: entity.condition.repairing,
  });
}

/** Project only the navigation fields an NPC steering rule may replace. */
export function selectNpcMovementState(npc: NpcShipEntity): NpcMovementState {
  return freezeNpcMovementState({
    position: npc.location.position,
    rotationDegrees: npc.location.rotationDegrees,
    motion: npc.motion,
    targetOffset: npc.navigation.targetOffset,
  });
}

export interface NpcWorldUpdate {
  readonly id: string;
  readonly movement: NpcMovementState;
}

export interface NpcDurabilityUpdate {
  readonly id: string;
  readonly condition: z.infer<typeof DurabilityComponentSchema>;
}

export interface WorldTickUpdate {
  readonly playerMovement: PlayerMovementState;
  readonly cameraZoom?: number;
  readonly npcUpdates?: readonly NpcWorldUpdate[];
  readonly npcDurabilityUpdates?: readonly NpcDurabilityUpdate[];
  readonly randomState?: number;
  readonly armament?: PrimaryWeaponState;
}

/** Index the optional damage set; durability cannot increase through this operation. */
function indexNpcDurabilityUpdates(
  world: WorldState,
  updates: readonly NpcDurabilityUpdate[],
): ReadonlyMap<string, z.infer<typeof DurabilityComponentSchema>> {
  const indexed = new Map<string, z.infer<typeof DurabilityComponentSchema>>();
  updates.forEach(update => {
    RuntimeEntityIdSchema.parse(update.id);
    if (indexed.has(update.id)) throw new Error(`Duplicate NPC durability update for ${update.id}.`);
    const entity = selectWorldEntity(world, update.id);
    if (!entity || entity.kind !== 'npc-ship') {
      throw new Error(`NPC durability update ${update.id} does not resolve to an existing ship.`);
    }
    const condition = DurabilityComponentSchema.parse(update.condition);
    if (condition.hull > entity.condition.hull || condition.shields > entity.condition.shields) {
      throw new Error('NPC hit resolution cannot increase durability.');
    }
    indexed.set(update.id, condition);
  });
  return indexed;
}

/** Validate the complete one-update-per-NPC set and index it for atomic use. */
function indexNpcWorldUpdates(
  world: WorldState,
  updates: readonly NpcWorldUpdate[],
): ReadonlyMap<string, NpcMovementState> {
  const indexed = new Map<string, NpcMovementState>();
  updates.forEach(update => {
    RuntimeEntityIdSchema.parse(update.id);
    if (indexed.has(update.id)) throw new Error(`Duplicate NPC update for ${update.id}.`);
    const entity = selectWorldEntity(world, update.id);
    if (!entity || entity.kind !== 'npc-ship') {
      throw new Error(`NPC update ${update.id} does not resolve to an existing ship.`);
    }
    indexed.set(update.id, NpcMovementStateSchema.parse(update.movement));
  });
  const npcCount = world.entities.filter(entity => entity.kind === 'npc-ship').length;
  if (indexed.size !== npcCount) throw new Error('Each NPC must have exactly one update per tick.');
  return indexed;
}

/**
 * Commit one completed world tick atomically. Module rules may update permitted
 * component values, but cannot replace entity identities, definitions, systems,
 * targets or the equipped primary weapon.
 */
export function commitWorldTick(world: WorldState, update: WorldTickUpdate): WorldState {
  const {
    playerMovement: playerMovementInput,
    cameraZoom = world.cameraZoom,
    npcUpdates = [],
    npcDurabilityUpdates = [],
    randomState = world.randomState,
    armament = selectPlayerEntity(world).armament,
  } = update;
  const playerMovement = freezePlayerMovementState(PlayerMovementStateSchema.parse(playerMovementInput));
  const currentPlayer = selectPlayerEntity(world);
  if (playerMovement.repairing !== currentPlayer.condition.repairing) {
    throw new Error('Movement rules cannot change the player repair state.');
  }
  if (!Number.isFinite(cameraZoom) || cameraZoom < 1 || cameraZoom > 16) {
    throw new Error('Camera zoom must be a finite denominator between 1 and 16.');
  }
  if (!isUInt32(randomState)) throw new Error('Invalid random state.');
  PrimaryWeaponStateSchema.parse(armament);
  if (armament.weaponDefinitionId !== currentPlayer.armament.weaponDefinitionId) {
    throw new Error('A tick cannot replace the equipped primary weapon.');
  }
  if (armament.shotSequence < currentPlayer.armament.shotSequence
    || armament.resolvedShotSequence < currentPlayer.armament.resolvedShotSequence) {
    throw new Error('A tick cannot roll back primary-weapon history.');
  }
  if (armament.shotSequence > currentPlayer.armament.shotSequence + 1) {
    throw new Error('A tick can accept at most one primary shot.');
  }
  const npcUpdatesById = indexNpcWorldUpdates(world, npcUpdates);
  const npcDurabilityById = indexNpcDurabilityUpdates(world, npcDurabilityUpdates);
  const updatedPlayer: PlayerShipEntity = {
    ...currentPlayer,
    location: {
      ...currentPlayer.location,
      position: playerMovement.position,
      rotationDegrees: playerMovement.rotationDegrees,
    },
    motion: {
      speedPerFrame: playerMovement.speedPerFrame,
      flightMode: playerMovement.flightMode,
    },
    condition: { ...currentPlayer.condition, energy: playerMovement.energy },
    armament,
    feedback: { notice: playerMovement.notice },
  };
  const updated = world.entities.map(entity => {
    if (entity.id === world.playerEntityId) return updatedPlayer;
    if (entity.kind !== 'npc-ship') return entity;
    const movementUpdate = npcUpdatesById.get(entity.id);
    if (!movementUpdate) return entity;
    const movement = freezeNpcMovementState(movementUpdate);
    const condition = npcDurabilityById.get(entity.id) ?? entity.condition;
    return {
      ...entity,
      location: {
        ...entity.location,
        position: movement.position,
        rotationDegrees: movement.rotationDegrees,
      },
      motion: movement.motion,
      condition,
      navigation: { ...entity.navigation, targetOffset: movement.targetOffset },
    };
  });
  // Validate only the focused transition inputs above; the prior world already
  // passed its boundary and unchanged components retain their references.
  return freezeWorld({ ...world, tick: world.tick + 1, cameraZoom, randomState, entities: updated });
}

/** Validate a targeting command without advancing simulation time. */
export function selectWorldTarget(world: WorldState, targetId: string | null): WorldState {
  if (targetId !== null) RuntimeEntityIdSchema.parse(targetId);
  if (targetId !== null) {
    const target = selectWorldEntity(world, targetId);
    if (!target || !isSelectableWorldEntity(target)) throw new Error(`Entity ${targetId} is not a selectable target.`);
  }
  if (world.selectedTargetEntityId === targetId) return world;
  return freezeWorld({ ...world, selectedTargetEntityId: targetId });
}

/** Store-validated destination intent, separate from targeting and travel. */
export function selectWorldDestination(world: WorldState, intent: DestinationSelectionIntent, knownSystemIds: readonly number[]): WorldState {
  if (world.status !== 'active') return world;
  const destination = DestinationSelectionIntentSchema.parse(intent).destinationSystemId;
  if (destination !== null && !knownSystemIds.includes(destination)) throw new Error(`Unknown destination system ${destination}.`);
  if (destination === selectPlayerEntity(world).location.systemId) throw new Error('Current system cannot be selected as a destination.');
  if (world.selectedDestinationSystemId === destination) return world;
  return freezeWorld({ ...world, selectedDestinationSystemId: destination });
}

/** Current removal contract: ordinary removal cannot delete the active player. */
export function removeWorldEntity(world: WorldState, entityId: string): WorldState {
  RuntimeEntityIdSchema.parse(entityId);
  if (entityId === world.playerEntityId) throw new Error('The active player requires the death-flow transition before removal.');
  if (!world.entities.some(entity => entity.id === entityId)) return world;
  if (world.entities.some(entity => entity.kind === 'npc-ship' && entity.navigation.targetEntityId === entityId)) {
    throw new Error('Cannot remove an entity while an NPC targets it.');
  }
  return freezeWorld({
    ...world,
    selectedTargetEntityId: world.selectedTargetEntityId === entityId ? null : world.selectedTargetEntityId,
    entities: world.entities.filter(entity => entity.id !== entityId),
  });
}
