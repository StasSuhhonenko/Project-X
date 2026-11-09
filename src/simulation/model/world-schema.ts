/**
 * Runtime world ownership for the player, planet and system stations.
 *
 * Runtime entity IDs identify instances and never reuse module definition IDs.
 * Coordinates are world units, rotation is clockwise degrees from up, and speed
 * is world units per simulation tick. Additional entity kinds enter this union
 * only when their components are consumed by an implemented feature.
 */
import { z } from 'zod';
import { UInt32Schema } from '../../random/seeded-random';
import { StationCommodityMarketSchema, TradeDemandSchema } from '../contracts/cargo-trade';
import { EncounterNameSchema } from '../contracts/encounter-rules';
import { NpcBeamEventsSchema } from '../contracts/npc-decision-rules';
import { PrimaryWeaponStateSchema, type PrimaryWeaponState } from './armament-state';
import { actorNavigation, isDecisionActor } from './decision-actor';
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
  StationPlacementIdSchema,
  SystemIdSchema,
} from './entity-components';
import { equipmentArmaments, EquipmentStateSchema, hasOwnedEquipment } from './equipment-state';
import { NpcGenerationSchema, StationCombatSchema, WorldLifecycleSchema } from './lifecycle-state';
import { VisitMissionStateSchema } from './mission-state';
import { NpcCombatStateSchema } from './npc-state';
import { PlayerIdentitySchema } from './player-identity';
import { ProgressionStateSchema } from './progression-schema';
import { ProjectileStateSchema } from './projectile-state';
import { ActorSpecialStatusSchema, NpcSpecialStatusSchema, SpecialEffectStateSchema } from './special-effect-state';
import { TradeOfferSchema } from './trade-offer';

export { RuntimeEntityIdSchema } from './entity-components';

const PlanetEntitySchema = z
  .object({
    id: RuntimeEntityIdSchema,
    kind: z.literal('planet'),
    location: LocationComponentSchema,
  })
  .strict()
  .readonly();

/** A stationary structure instance; definition and authored placement stay distinct. */
const StationEntitySchema = z
  .object({
    commodityMarket: StationCommodityMarketSchema.nullable().default(null),
    id: RuntimeEntityIdSchema,
    kind: z.literal('station'),
    stationId: StationPlacementIdSchema,
    combat: StationCombatSchema.nullable().optional().default(null),
    definitionId: PositiveDefinitionIdSchema,
    location: LocationComponentSchema,
  })
  .strict()
  .readonly();

export { PrimaryWeaponStateSchema } from './armament-state';
export type { PrimaryWeaponState } from './armament-state';

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
  return (
    shot.sequence === armament.shotSequence &&
    shot.weaponDefinitionId === armament.weaponDefinitionId &&
    shot.tick <= tick
  );
}

const PlayerShipEntitySchema = z
  .object({
    id: RuntimeEntityIdSchema,
    kind: z.literal('player-ship'),
    specialStatus: ActorSpecialStatusSchema,
    /** The single authoritative display identity, independent of definitions. */
    identity: PlayerIdentitySchema.nullable(),
    definitionId: PositiveDefinitionIdSchema,
    location: LocationComponentSchema,
    motion: PlayerMotionComponentSchema,
    condition: PlayerConditionComponentSchema,
    inventory: InventoryComponentSchema,
    armament: PrimaryWeaponStateSchema,
    equipment: EquipmentStateSchema.nullable().default(null),
    feedback: PlayerFeedbackComponentSchema,
  })
  .strict()
  .readonly();

/** Mobile non-player ship with engine-validated, module-selected navigation intent. */
const NpcShipEntitySchema = z
  .object({
    tradeSeed: UInt32Schema.nullable().default(null),
    tradeDemand: TradeDemandSchema.nullable().default(null),
    id: RuntimeEntityIdSchema,
    kind: z.literal('npc-ship'),
    /** Sole current allegiance owner, including lifecycle-generated defenders. */
    governmentId: z.number().int().positive(),
    combat: NpcCombatStateSchema,
    /** Dedicated actor stream; required on construction and restore. */
    randomState: UInt32Schema,
    encounter: z
      .object({ name: EncounterNameSchema, raceId: z.number().int().positive().nullable() })
      .strict()
      .readonly()
      .nullable()
      .default(null),
    specialStatus: NpcSpecialStatusSchema,
    definitionId: PositiveDefinitionIdSchema,
    location: LocationComponentSchema,
    motion: NpcMotionComponentSchema,
    condition: DurabilityComponentSchema,
    navigation: NpcNavigationIntentSchema,
    generation: NpcGenerationSchema.nullable().optional().default(null),
    tradeOffer: TradeOfferSchema.nullable(),
  })
  .strict()
  .superRefine((actor, context) => {
    if (actor.generation && actor.generation.governmentId !== actor.governmentId)
      context.addIssue({
        code: 'custom',
        path: ['governmentId'],
        message: 'NPC allegiance differs from its generation witness.',
      });
    if (actor.generation && actor.encounter)
      context.addIssue({
        code: 'custom',
        path: ['encounter'],
        message: 'An NPC cannot have both lifecycle and encounter provenance.',
      });
  })
  .readonly();

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

export const WorldStateSchema = z
  .object({
    /** Visit-owned realized offers; null means no module mission capability. */
    missions: VisitMissionStateSchema.nullable().default(null),
    /** Captain-owned progress survives vessel replacement; null means no module declaration. */
    progression: ProgressionStateSchema.nullable(),
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
    npcBeamEvents: NpcBeamEventsSchema.default([]),
    /** Pre-encounter allocation cursor captured at entry, never recomputed on restore. */
    entryActorSlotCount: z.number().int().nonnegative().max(100000),
    specialActorSlots: z.array(RuntimeEntityIdSchema.nullable()).max(100000).readonly().default([]),
    specialEffects: z.array(SpecialEffectStateSchema).max(1024).readonly().default([]),
    projectiles: z.array(ProjectileStateSchema).max(1024).readonly().default([]),
    entities: z
      .array(
        z.discriminatedUnion('kind', [
          PlayerShipEntitySchema,
          PlanetEntitySchema,
          StationEntitySchema,
          NpcShipEntitySchema,
        ])
      )
      .min(1)
      .readonly(),
  })
  .strict()
  .superRefine((world, context) => {
    if (
      world.npcBeamEvents.some(
        event =>
          event.tick !== world.tick ||
          Number(event.emitterEntityId.slice(7)) >= world.nextEntitySequence ||
          Number(event.targetEntityId.slice(7)) >= world.nextEntitySequence
      )
    )
      context.addIssue({
        code: 'custom',
        path: ['npcBeamEvents'],
        message: 'Beam events must describe this completed tick and allocated actors.',
      });
    const ids = [
      ...world.entities.map(entity => entity.id),
      ...world.projectiles.map(projectile => projectile.id),
      ...world.specialEffects.map(effect => effect.id),
    ];
    if (
      world.specialEffects.some(
        effect =>
          effect.systemId !== world.entities.find(entity => entity.kind === 'player-ship')?.location.systemId ||
          effect.emitterEntityId !== world.playerEntityId ||
          effect.spawnedTick > world.tick ||
          effect.ageTicks !== world.tick - effect.spawnedTick ||
          (effect.kind === 'tractor' && effect.targetEntityId === effect.emitterEntityId)
      )
    )
      context.addIssue({
        code: 'custom',
        path: ['specialEffects'],
        message: 'Special effect identity, age or system is inconsistent.',
      });
    if (
      world.specialEffects.some(
        (effect, index) =>
          index > 0 &&
          Number(effect.id.slice('entity-'.length)) <=
            Number(world.specialEffects[index - 1]!.id.slice('entity-'.length))
      )
    )
      context.addIssue({
        code: 'custom',
        path: ['specialEffects'],
        message: 'Special effects must retain allocation order.',
      });
    if (
      world.projectiles.some(
        projectile =>
          projectile.systemId !== world.entities.find(entity => entity.kind === 'player-ship')?.location.systemId ||
          projectile.spawnedTick > world.tick ||
          projectile.ageTicks !== world.tick - projectile.spawnedTick ||
          Number(projectile.emitterEntityId.slice(7)) >= Number(projectile.id.slice(7)) ||
          projectile.targetEntityId === projectile.emitterEntityId ||
          (projectile.targetEntityId !== null &&
            Number(projectile.targetEntityId.slice(7)) >= Number(projectile.id.slice(7))) ||
          (projectile.impactAgeTicks !== null && projectile.impactAgeTicks >= projectile.ageTicks)
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['projectiles'],
        message: 'Projectile system, emitter or age is inconsistent.',
      });
    }
    if (
      world.projectiles.some(
        (shot, index) => index > 0 && Number(shot.id.slice(7)) <= Number(world.projectiles[index - 1]!.id.slice(7))
      )
    )
      context.addIssue({ code: 'custom', path: ['projectiles'], message: 'Projectiles must retain allocation order.' });
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: 'custom', path: ['entities'], message: 'Runtime entity IDs must be unique.' });
    }
    const players = world.entities.filter(entity => entity.kind === 'player-ship');
    if (players.length !== 1 || players[0]?.id !== world.playerEntityId) {
      context.addIssue({
        code: 'custom',
        path: ['playerEntityId'],
        message: 'Player entity ID must resolve in the world.',
      });
    }
    const playerHull = players[0]?.condition.hull;
    if ((world.status === 'active' && playerHull === 0) || (world.status === 'player-destroyed' && playerHull !== 0)) {
      context.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'World status and player hull must describe the same lifecycle state.',
      });
    }
    const equipmentPlayer = players[0];
    if (
      equipmentPlayer &&
      (!hasOwnedEquipment(equipmentPlayer) ||
        equipmentArmaments(equipmentPlayer).some(a => !isPrimaryWeaponHistoryConsistent(a, world.tick)))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['entities'],
        message: 'Equipment ownership or channel history is inconsistent.',
      });
    }
    const weaponState = players[0]?.armament;
    if (weaponState && !isPrimaryWeaponHistoryConsistent(weaponState, world.tick)) {
      context.addIssue({ code: 'custom', path: ['entities'], message: 'Primary weapon shot history is inconsistent.' });
    }
    const selectedTarget =
      world.selectedTargetEntityId === null ? null : findEntity(world.entities, world.selectedTargetEntityId);
    if (world.selectedTargetEntityId !== null && (!selectedTarget || !isSelectableWorldEntity(selectedTarget))) {
      context.addIssue({
        code: 'custom',
        path: ['selectedTargetEntityId'],
        message: 'Selected target must resolve to a selectable entity.',
      });
    }
    if (world.selectedDestinationSystemId === players[0]?.location.systemId) {
      context.addIssue({
        code: 'custom',
        path: ['selectedDestinationSystemId'],
        message: 'Current system cannot be a travel destination.',
      });
    }
    const planets = world.entities.filter(entity => entity.kind === 'planet');
    if (
      world.missions &&
      (world.missions.systemId !== players[0]?.location.systemId || world.missions.visitEntityId !== planets[0]?.id)
    )
      context.addIssue({
        code: 'custom',
        path: ['missions'],
        message: 'Missions must belong to the active planet visit.',
      });
    if (planets.length > 1 || planets.some(planet => planet.location.systemId !== players[0]?.location.systemId)) {
      context.addIssue({
        code: 'custom',
        path: ['entities'],
        message: 'The planet must belong to the active system and be unique.',
      });
    }
    const stations = world.entities.filter(entity => entity.kind === 'station');
    if (stations.some(station => station.location.systemId !== players[0]?.location.systemId)) {
      context.addIssue({ code: 'custom', path: ['entities'], message: 'Stations must belong to the active system.' });
    }
    if (new Set(stations.map(station => station.stationId)).size !== stations.length) {
      context.addIssue({ code: 'custom', path: ['entities'], message: 'Station placements must have unique IDs.' });
    }
    if (
      world.entities.some(entity => {
        if (!isDecisionActor(entity)) return false;
        const navigation = actorNavigation(entity);
        if (navigation.targetEntityId === null) return false;
        const target = findEntity(world.entities, navigation.targetEntityId);
        return (
          entity.location.systemId !== players[0]?.location.systemId ||
          !target ||
          target.id === entity.id ||
          target.location.systemId !== entity.location.systemId
        );
      })
    ) {
      context.addIssue({
        code: 'custom',
        path: ['entities'],
        message: 'NPC navigation targets must resolve in the active system.',
      });
    }
    if (world.entities.some(entity => entity.kind === 'npc-ship' && entity.condition.hull === 0)) {
      context.addIssue({
        code: 'custom',
        path: ['entities'],
        message: 'Destroyed NPCs must be settled before publication.',
      });
    }
    const actorSlots = world.specialActorSlots.filter((id): id is string => id !== null);
    if (
      new Set(actorSlots).size !== actorSlots.length ||
      actorSlots.some(
        id =>
          !world.entities.some(entity => entity.id === id && (entity.kind === 'station' || entity.kind === 'npc-ship'))
      )
    )
      context.addIssue({
        code: 'custom',
        path: ['specialActorSlots'],
        message: 'Special actor slots must reference unique live actors.',
      });
    const allocatedSequences = ids.map(id => Number(id.slice('entity-'.length)));
    const slots = world.lifecycle.stationSpawnSlots;
    if (slots) {
      const references = slots.filter((id): id is string => id !== null);
      if (
        slots.length === 0 ||
        slots[0] !== null ||
        new Set(references).size !== references.length ||
        references.some(id => !stations.some(station => station.id === id))
      )
        context.addIssue({
          code: 'custom',
          path: ['lifecycle', 'stationSpawnSlots'],
          message: 'Spawn slots must reference unique active stations.',
        });
    }
    if (allocatedSequences.some(sequence => sequence >= world.nextEntitySequence)) {
      context.addIssue({
        code: 'custom',
        path: ['nextEntitySequence'],
        message: 'Next entity sequence must exceed every allocated ID.',
      });
    }
  })
  .readonly();

export type WorldState = z.infer<typeof WorldStateSchema>;

function freezeEntity(entity: WorldState['entities'][number]): WorldState['entities'][number] {
  if (entity.kind === 'player-ship' || entity.kind === 'npc-ship') Object.freeze(entity.specialStatus);
  Object.freeze(entity.location.position);
  Object.freeze(entity.location);
  if (entity.kind === 'npc-ship') {
    Object.freeze(entity.combat);
    if (entity.generation) Object.freeze(entity.generation);
    if (entity.encounter) Object.freeze(entity.encounter);
    Object.freeze(entity.motion);
    Object.freeze(entity.condition);
    Object.freeze(entity.navigation.targetOffset);
    Object.freeze(entity.navigation);
    if (entity.tradeOffer) Object.freeze(entity.tradeOffer);
    if (entity.tradeDemand) Object.freeze(entity.tradeDemand);
    return Object.freeze(entity);
  }
  if (entity.kind === 'station' && entity.combat) {
    Object.freeze(entity.combat.state);
    Object.freeze(entity.combat.navigation.targetOffset);
    Object.freeze(entity.combat.navigation);
    Object.freeze(entity.combat);
  }
  if (entity.kind === 'station' && entity.commodityMarket) {
    entity.commodityMarket.rows.forEach(Object.freeze);
    Object.freeze(entity.commodityMarket.rows);
    Object.freeze(entity.commodityMarket);
  }
  if (entity.kind !== 'player-ship') return Object.freeze(entity);
  if (entity.identity) Object.freeze(entity.identity);
  Object.freeze(entity.motion);
  Object.freeze(entity.condition);
  Object.freeze(entity.inventory.resources);
  entity.inventory.cargo.forEach(pod => {
    if (pod.contract) Object.freeze(pod.contract);
    Object.freeze(pod);
  });
  Object.freeze(entity.inventory.cargo);
  Object.freeze(entity.inventory);
  if (entity.armament.lastAcceptedShot) Object.freeze(entity.armament.lastAcceptedShot);
  Object.freeze(entity.armament);
  if (entity.equipment) {
    Object.freeze(entity.equipment.ownedWeaponIds);
    Object.freeze(entity.equipment.technologyWeaponIds);
    entity.equipment.additionalArmaments.forEach(a => {
      if (a.lastAcceptedShot) Object.freeze(a.lastAcceptedShot);
      Object.freeze(a);
    });
    Object.freeze(entity.equipment.additionalArmaments);
    Object.freeze(entity.equipment);
  }
  if (entity.feedback.communication) Object.freeze(entity.feedback.communication);
  if (entity.feedback.notice) Object.freeze(entity.feedback.notice);
  Object.freeze(entity.feedback);
  return Object.freeze(entity);
}

/** Internal publication helper for already validated focused transitions.
 * External construction/restore must use parseWorldState instead.
 */
export function freezeWorld(world: WorldState): WorldState {
  if (world.missions) {
    world.missions.entryStanding.forEach(Object.freeze);
    Object.freeze(world.missions.entryStanding);
    Object.freeze(world.missions.stationIds);
    if (world.missions.planetOffer) Object.freeze(world.missions.planetOffer);
    Object.values(world.missions.stationOffers).forEach(offer => {
      if (offer) Object.freeze(offer);
    });
    Object.freeze(world.missions.stationOffers);
    Object.values(world.missions.negotiations).forEach(context => {
      Object.freeze(context.offer);
      if (context.progression) {
        Object.freeze(context.progression.experience);
        Object.freeze(context.progression.tallies);
        Object.freeze(context.progression);
      }
      Object.freeze(context);
    });
    Object.freeze(world.missions.negotiations);
    Object.freeze(world.missions);
  }
  if (world.progression) {
    Object.freeze(world.progression.experience);
    Object.freeze(world.progression.tallies);
    Object.freeze(world.progression);
  }
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
  world.npcBeamEvents.forEach(event => {
    Object.freeze(event.origin);
    Object.freeze(event.targetPosition);
    Object.freeze(event);
  });
  Object.freeze(world.npcBeamEvents);
  world.entities.forEach(freezeEntity);
  world.projectiles.forEach(projectile => {
    Object.freeze(projectile.position);
    Object.freeze(projectile);
  });
  Object.freeze(world.projectiles);
  world.specialEffects.forEach(effect => {
    Object.freeze(effect.origin);
    Object.freeze(effect.policy);
    if (effect.kind === 'pulse') {
      effect.scanSegments.forEach(Object.freeze);
      Object.freeze(effect.scanSegments);
    }
    Object.freeze(effect);
  });
  Object.freeze(world.specialEffects);
  Object.freeze(world.specialActorSlots);
  Object.freeze(world.entities);
  return Object.freeze(world);
}

/** Validate and deeply freeze a newly constructed or restored world boundary. */
export function parseWorldState(input: unknown): WorldState {
  return freezeWorld(WorldStateSchema.parse(input));
}
