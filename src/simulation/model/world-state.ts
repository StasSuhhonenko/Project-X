/** Validated world operations. Schemas/ownership and read-only selectors have
 * separate owners; this facade retains the existing public model imports. */
import { z } from 'zod';
import { isUInt32 } from '../../random/seeded-random';
import { DestinationSelectionIntentSchema, type DestinationSelectionIntent } from '../commands/destination-selection';
import { DEFAULT_CARGO_SLOT_CAPACITY, settleCargoTrade, type CargoTradeEnvironment } from './cargo-transactions';
import {
  DurabilityComponentSchema,
  PlayerNoticeSchema,
  ResourceBalancesSchema,
  RuntimeEntityIdSchema,
} from './entity-components';
import { EquipmentStateSchema, type EquipmentState } from './equipment-state';
import { freezeNpcMovementState, NpcMovementStateSchema, type NpcMovementState } from './npc-state';
import { freezePlayerMovementState, PlayerMovementStateSchema, type PlayerMovementState } from './player-state';
import { ProjectileStateSchema, type ProjectileState } from './projectile-state';
import {
  ActorSpecialStatusSchema,
  SpecialEffectStateSchema,
  type ActorSpecialStatus,
  type SpecialEffectState,
} from './special-effect-state';
import {
  freezeWorld,
  isPrimaryWeaponHistoryConsistent,
  isSelectableWorldEntity,
  parseWorldState,
  PrimaryWeaponStateSchema,
  type PlayerShipEntity,
  type PrimaryWeaponState,
  type WorldState,
} from './world-schema';
import { selectPlayerEntity, selectWorldEntity } from './world-selectors';

export {
  PrimaryWeaponStateSchema,
  WorldStateSchema,
  WorldStatusSchema,
  RuntimeEntityIdSchema,
  isSelectableWorldEntity,
  parseWorldState,
} from './world-schema';
export type {
  PrimaryWeaponState,
  PlayerShipEntity,
  NpcShipEntity,
  PlanetEntity,
  StationEntity,
  WorldEntity,
  SelectableWorldEntity,
  WorldStatus,
  WorldState,
} from './world-schema';
export * from './world-selectors';

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
    entities: world.entities.map(entity =>
      entity.kind !== 'player-ship'
        ? entity
        : {
            ...entity,
            condition: { ...entity.condition, ...durability, repairing },
            inventory: { ...entity.inventory, resources },
            feedback: { ...entity.feedback, notice },
          }
    ),
  });
}

/** Commit an already quoted quantity, checking payment, capacity and stock again. */
export function commitTradePurchase(
  world: WorldState,
  npcId: string,
  quantityTons: number,
  cargoCapacityTons: number,
  environment?: Omit<CargoTradeEnvironment, 'cargoCapacityTons'>
): WorldState {
  const target = world.entities.find(entity => entity.id === npcId);
  if (!target) throw new Error('Purchase merchant is unavailable.');
  const result = settleCargoTrade(
    world,
    {
      cargoCapacityTons,
      slotCapacity: environment?.slotCapacity ?? DEFAULT_CARGO_SLOT_CAPACITY,
      plan: environment?.plan,
    },
    { merchantEntityId: npcId, systemId: target.location.systemId, side: 'buy', row: 0, quantityTons }
  );
  if (result.refusal)
    throw new Error('Purchase is unavailable for the current merchant, quantity, capacity or balance.');
  return result.world;
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
  readonly projectileEmission?: ProjectileState | null;
  readonly specialEmission?: SpecialEffectState | null | undefined;
  readonly specialStatus?: ActorSpecialStatus | undefined;
  readonly playerMovement: PlayerMovementState;
  readonly cameraZoom?: number;
  readonly npcUpdates?: readonly NpcWorldUpdate[];
  readonly npcDurabilityUpdates?: readonly NpcDurabilityUpdate[];
  readonly randomState?: number;
  readonly armament?: PrimaryWeaponState;
  readonly equipment?: EquipmentState;
}

/** Index the optional damage set; durability cannot increase through this operation. */
function indexNpcDurabilityUpdates(
  world: WorldState,
  updates: readonly NpcDurabilityUpdate[]
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
  updates: readonly NpcWorldUpdate[]
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
    armament: armamentInput = selectPlayerEntity(world).armament,
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
  const armament = PrimaryWeaponStateSchema.parse(armamentInput);
  if (!isPrimaryWeaponHistoryConsistent(armament, world.tick + 1)) {
    throw new Error('Primary weapon shot history is inconsistent.');
  }
  if (armament.weaponDefinitionId !== currentPlayer.armament.weaponDefinitionId) {
    throw new Error('A tick cannot replace the equipped primary weapon.');
  }
  if (
    armament.shotSequence < currentPlayer.armament.shotSequence ||
    armament.resolvedShotSequence < currentPlayer.armament.resolvedShotSequence
  ) {
    throw new Error('A tick cannot roll back primary-weapon history.');
  }
  if (armament.shotSequence > currentPlayer.armament.shotSequence + 1) {
    throw new Error('A tick can accept at most one primary shot.');
  }
  const equipment = update.equipment ? EquipmentStateSchema.parse(update.equipment) : currentPlayer.equipment;
  if (update.equipment) {
    if (
      !currentPlayer.equipment ||
      equipment!.revision !== currentPlayer.equipment.revision ||
      JSON.stringify(equipment!.ownedWeaponIds) !== JSON.stringify(currentPlayer.equipment.ownedWeaponIds) ||
      JSON.stringify(equipment!.technologyWeaponIds) !== JSON.stringify(currentPlayer.equipment.technologyWeaponIds) ||
      equipment!.marketAdjustment !== currentPlayer.equipment.marketAdjustment
    )
      throw Error('A tick cannot change equipment ownership.');
    equipment!.additionalArmaments.forEach((channel, i) => {
      const old = currentPlayer.equipment!.additionalArmaments[i]!;
      if (
        channel.weaponDefinitionId !== old.weaponDefinitionId ||
        !isPrimaryWeaponHistoryConsistent(channel, world.tick + 1) ||
        channel.shotSequence < old.shotSequence ||
        channel.shotSequence > old.shotSequence + 1 ||
        channel.resolvedShotSequence < old.resolvedShotSequence
      )
        throw Error('Invalid firing-channel transition.');
    });
  }
  const npcUpdatesById = indexNpcWorldUpdates(world, npcUpdates);
  const npcDurabilityById = indexNpcDurabilityUpdates(world, npcDurabilityUpdates);
  const updatedPlayer: PlayerShipEntity = {
    ...currentPlayer,
    specialStatus: ActorSpecialStatusSchema.parse(
      update.specialStatus ?? {
        ...currentPlayer.specialStatus,
        hitFlag: 0,
        engineDisabledFrames: Math.max(0, currentPlayer.specialStatus.engineDisabledFrames - 1),
      }
    ),
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
    equipment,
    feedback: { ...currentPlayer.feedback, notice: playerMovement.notice },
  };
  const emission = update.projectileEmission ? ProjectileStateSchema.parse(update.projectileEmission) : null;
  if (
    emission &&
    (emission.id !== `entity-${world.nextEntitySequence}` ||
      emission.emitterEntityId !== currentPlayer.id ||
      emission.emitterDefinitionId !== currentPlayer.definitionId ||
      emission.systemId !== currentPlayer.location.systemId ||
      emission.spawnedTick !== world.tick + 1 ||
      emission.ageTicks !== 0 ||
      emission.impactAgeTicks !== null ||
      emission.weaponDefinitionId !== armament.lastAcceptedShot?.weaponDefinitionId ||
      emission.targetEntityId !== armament.lastAcceptedShot?.targetEntityId ||
      armament.shotSequence !== currentPlayer.armament.shotSequence + 1 ||
      emission.position.x !== playerMovement.position.x ||
      emission.position.y !== playerMovement.position.y ||
      emission.launchSpeedPerFrame !== Math.abs(playerMovement.speedPerFrame))
  )
    throw Error('Projectile emission does not match the newly accepted primary command.');
  const specialEmission = update.specialEmission ? SpecialEffectStateSchema.parse(update.specialEmission) : null;
  if (
    specialEmission &&
    (emission ||
      specialEmission.id !== `entity-${world.nextEntitySequence}` ||
      specialEmission.emitterEntityId !== currentPlayer.id ||
      specialEmission.emitterDefinitionId !== currentPlayer.definitionId ||
      specialEmission.systemId !== currentPlayer.location.systemId ||
      specialEmission.spawnedTick !== world.tick + 1 ||
      specialEmission.ageTicks !== 0 ||
      specialEmission.weaponDefinitionId !== armament.lastAcceptedShot?.weaponDefinitionId ||
      armament.shotSequence !== currentPlayer.armament.shotSequence + 1)
  )
    throw Error('Invalid special effect emission.');
  if (specialEmission && !Number.isSafeInteger(world.nextEntitySequence + 1))
    throw Error('Special allocator overflow.');
  if (emission && !Number.isSafeInteger(world.nextEntitySequence + 1)) throw Error('Projectile allocator overflow.');
  const updated = world.entities.map(entity => {
    if (entity.id === world.playerEntityId) return updatedPlayer;
    if (entity.kind !== 'npc-ship') return entity;
    const movementUpdate = npcUpdatesById.get(entity.id);
    if (!movementUpdate) return entity;
    const movement = freezeNpcMovementState(movementUpdate);
    const condition = npcDurabilityById.get(entity.id) ?? entity.condition;
    return {
      ...entity,
      specialStatus: {
        ...entity.specialStatus,
        hitFlag: 0,
        engineDisabledFrames: Math.max(0, entity.specialStatus.engineDisabledFrames - 1),
      },
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
  return freezeWorld({
    ...world,
    tick: world.tick + 1,
    cameraZoom,
    randomState,
    entities: updated,
    nextEntitySequence: world.nextEntitySequence + (emission || specialEmission ? 1 : 0),
    specialEffects: [
      ...world.specialEffects.map(effect => ({ ...effect, ageTicks: world.tick + 1 - effect.spawnedTick })),
      ...(specialEmission ? [specialEmission] : []),
    ],
    projectiles: [
      ...world.projectiles.map(projectile => ({ ...projectile, ageTicks: world.tick + 1 - projectile.spawnedTick })),
      ...(emission ? [emission] : []),
    ],
  });
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
export function selectWorldDestination(
  world: WorldState,
  intent: DestinationSelectionIntent,
  knownSystemIds: readonly number[]
): WorldState {
  if (world.status !== 'active') return world;
  const destination = DestinationSelectionIntentSchema.parse(intent).destinationSystemId;
  if (destination !== null && !knownSystemIds.includes(destination))
    throw new Error(`Unknown destination system ${destination}.`);
  if (destination === selectPlayerEntity(world).location.systemId)
    throw new Error('Current system cannot be selected as a destination.');
  if (world.selectedDestinationSystemId === destination) return world;
  return freezeWorld({ ...world, selectedDestinationSystemId: destination });
}

/** Current removal contract: ordinary removal cannot delete the active player. */
export function removeWorldEntity(world: WorldState, entityId: string): WorldState {
  RuntimeEntityIdSchema.parse(entityId);
  if (entityId === world.playerEntityId)
    throw new Error('The active player requires the death-flow transition before removal.');
  if (!world.entities.some(entity => entity.id === entityId)) return world;
  if (world.entities.some(entity => entity.kind === 'npc-ship' && entity.navigation.targetEntityId === entityId)) {
    throw new Error('Cannot remove an entity while an NPC targets it.');
  }
  return freezeWorld({
    ...world,
    selectedTargetEntityId: world.selectedTargetEntityId === entityId ? null : world.selectedTargetEntityId,
    specialActorSlots: world.specialActorSlots.map(id => (id === entityId ? null : id)),
    entities: world.entities.filter(entity => entity.id !== entityId),
  });
}
