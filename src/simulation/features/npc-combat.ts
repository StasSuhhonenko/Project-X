/** Shared post-repair NPC phase. Each decision and its immediate beams settle
 * before the next actor observes the slot table. This deterministic order bias
 * is deliberate; it is not a claim about a legacy clip scheduler. */
import { WeaponDefinitionSchema, type EntityDefinition } from '../../content/schemas/game-content';
import type { GameRules } from '../contracts/game-rules';
import {
  NpcBeamEventSchema,
  NpcBeamEventsSchema,
  NpcDecisionPlayerSchema,
  NpcDecisionSchema,
  NpcDecisionSelfSchema,
  NpcDecisionSlotSchema,
  NpcPlayerShotContextSchema,
  NpcTargetResponseSchema,
  type NpcDecision,
  type NpcDecisionContext,
  type NpcDecisionSlot,
} from '../contracts/npc-decision-rules';
import {
  actorCombat,
  actorNavigation,
  actorRandomState,
  actorSize,
  isDecisionActor,
  withActorDecisionState,
  type DecisionActor,
} from '../model/decision-actor';
import { PlayerNoticeSchema } from '../model/entity-components';
import { combinedDurabilityPercent } from '../model/npc-state';
import type { SpecialEffectState } from '../model/special-effect-state';
import { freezeWorld } from '../model/world-schema';
import { selectPlayerEntity, selectWorldEntity, type PrimaryWeaponState, type WorldState } from '../model/world-state';
import type { AdvanceWorldInput } from './advance-world';
import { departActor } from './departure';
import { commitPlayerDurability } from './destruction';
import { applyLifecycleHit, createLifecycleDefinitions, prepareActorHit } from './lifecycle-hit';
import { advanceNpcNavigation } from './npc-navigation';
import { createProjectile, validateProjectileCapability } from './projectiles';

/** Resolve only active-system targets. Historical shots may have absent targets;
 * new decisions and response writes cannot introduce such dangling references. */
function validateTarget(world: WorldState, id: string | null, ownerId?: string): void {
  if (id === null) return;
  if (id === ownerId) throw new Error('Actor intent cannot target itself.');
  const entity = selectWorldEntity(world, id);
  if (!entity || entity.location.systemId !== selectPlayerEntity(world).location.systemId)
    throw new Error('NPC intent target is absent from the active system.');
}

/** Single accepted-emission response owner reused by both channel hosts.
 * Costs/history are already accepted, but damage and NPC decisions have not run.
 * A targeted projectile provokes on launch, never again on delayed impact.
 * An absent hook or null result leaves the victim's intent unchanged. */
export function applyPlayerShotResponse(
  world: WorldState,
  previous: PrimaryWeaponState,
  emitted: PrimaryWeaponState,
  rules: GameRules,
  specialEmission?: SpecialEffectState | null,
  systems: NpcPhaseInput['systems'] = []
): WorldState {
  if (world.status !== 'active') return world;
  const shot = emitted.lastAcceptedShot;
  if (!shot || shot.sequence <= previous.shotSequence || shot.targetEntityId === null) return world;
  // Selection recorded in a cloak/area-device history is not a directed shot.
  // A targeted device must actually emit (a paid out-of-range attempt does not).
  const special = rules.getSpecialWeapon?.(shot.weaponDefinitionId);
  if (special && (special.kind !== 'tractor' || specialEmission?.kind !== 'tractor')) return world;
  const actor = selectWorldEntity(world, shot.targetEntityId);
  if (!actor || !isDecisionActor(actor) || (actor.kind === 'npc-ship' && actor.condition.hull === 0)) return world;
  const context = NpcPlayerShotContextSchema.parse({
    actor: Object.freeze({
      id: actor.id,
      governmentId:
        actor.kind === 'npc-ship'
          ? actor.governmentId
          : (systems?.find(system => system.id === actor.location.systemId)?.governmentId ?? null),
      combat: actorCombat(actor),
      targetEntityId: actorNavigation(actor).targetEntityId,
    }),
    playerEntityId: world.playerEntityId,
    weaponDefinitionId: shot.weaponDefinitionId,
  });
  const result = rules.respondToPlayerShot?.(context) ?? null;
  if (result === null) return world;
  const response = NpcTargetResponseSchema.parse(result);
  validateTarget(world, response.targetEntityId, actor.id);
  return freezeWorld({
    ...world,
    entities: world.entities.map(entity =>
      entity.id === actor.id
        ? withActorDecisionState(
            actor,
            { ...actorCombat(actor), alert: response.alert },
            { ...actorNavigation(actor), targetEntityId: response.targetEntityId }
          )
        : entity
    ),
  });
}

type NpcPhaseInput = Pick<
  AdvanceWorldInput,
  'rules' | 'definitions' | 'systems' | 'lifecycle' | 'progression' | 'combatGeometry'
>;

/** Project the ordered slot table into the decision view. Holes stay null so a
 * module can reproduce source cursor arithmetic and observe preceding writes. */
function projectDecisionSlots(
  state: WorldState,
  systems: NpcPhaseInput['systems'],
  previous: readonly (NpcDecisionSlot | null)[] = []
): readonly (NpcDecisionSlot | null)[] {
  return Object.freeze(
    state.specialActorSlots.map((actorId, index) => {
      const actor = actorId === null ? null : selectWorldEntity(state, actorId);
      if (!actor || (actor.kind !== 'npc-ship' && actor.kind !== 'station')) return null;
      // Decisions change only targets/alerts, never slot identity/position.
      // Reuse detached frozen projections while these observed values agree;
      // rebuilding every Zod projection for every actor made long command
      // campaigns quadratic in validation work. Later actors still see writes.
      const prior = previous[index];
      if (
        prior &&
        prior.id === actor.id &&
        prior.position.x === actor.location.position.x &&
        prior.position.y === actor.location.position.y &&
        prior.targetEntityId === (isDecisionActor(actor) ? actorNavigation(actor).targetEntityId : null) &&
        prior.alert === (isDecisionActor(actor) ? actorCombat(actor).alert : null)
      )
        return prior;
      return NpcDecisionSlotSchema.parse({
        id: actor.id,
        kind: actor.kind,
        governmentId:
          actor.kind === 'npc-ship'
            ? actor.governmentId
            : (systems?.find(system => system.id === actor.location.systemId)?.governmentId ?? null),
        position: actor.location.position,
        targetEntityId: isDecisionActor(actor) ? actorNavigation(actor).targetEntityId : null,
        alert: isDecisionActor(actor) ? actorCombat(actor).alert : null,
      });
    })
  );
}

/** Build the detached, frozen read-only view one decision may observe. */
function createDecisionContext(
  state: WorldState,
  npc: DecisionActor,
  vessel: EntityDefinition,
  { definitions, systems = [] }: NpcPhaseInput,
  slots = projectDecisionSlots(state, systems),
  selectedTargetEntityId = state.selectedTargetEntityId
): NpcDecisionContext {
  const player = selectPlayerEntity(state);
  const system = systems.find(candidate => candidate.id === player.location.systemId);
  const planet = state.entities.find(entity => entity.kind === 'planet');
  if (!planet) throw new Error('NPC decisions require the active planet.');
  return Object.freeze({
    self: NpcDecisionSelfSchema.parse({
      id: npc.id,
      orderId: state.fleet?.deployments.find(link => link.entityId === npc.id)?.orderId ?? null,
      definitionId: npc.definitionId,
      kind: npc.kind,
      strengthPercent:
        npc.kind === 'station'
          ? (npc.combat.strength / npc.combat.maximumStrength) * 100
          : combinedDurabilityPercent(npc.condition, { hull: vessel.maximumHull, shields: vessel.maximumShields }),
      governmentId: npc.kind === 'npc-ship' ? npc.governmentId : (system?.governmentId ?? null),
      sizeClass: actorSize(vessel),
      maximumHull: vessel.maximumHull,
      maximumShields: vessel.maximumShields,
      weaponDefinitionIds: vessel.startingWeaponIds,
      name: npc.kind === 'npc-ship' ? (npc.encounter?.name ?? npc.generation?.name ?? vessel.name) : vessel.name,
      position: npc.location.position,
      rotationDegrees: npc.location.rotationDegrees,
      speedPerFrame: npc.kind === 'npc-ship' ? npc.motion.speedPerFrame : 0,
      condition: npc.kind === 'npc-ship' ? npc.condition : { hull: npc.combat.strength, shields: 0 },
      engineDisabledFrames: npc.kind === 'npc-ship' ? npc.specialStatus.engineDisabledFrames : 0,
      combat: actorCombat(npc),
      targetEntityId: actorNavigation(npc).targetEntityId,
      targetOffset: actorNavigation(npc).targetOffset,
      hailEligible:
        npc.kind === 'npc-ship' &&
        npc.tradeDemand !== null &&
        player.inventory.cargo.some(pod => pod.goodsId === npc.tradeDemand!.goodsId),
      randomState: actorRandomState(npc),
    }),
    slots,
    player: NpcDecisionPlayerSchema.parse({
      id: player.id,
      selectedTargetEntityId,
      position: player.location.position,
      cloaked: player.specialStatus.cloaked,
      condition: { hull: player.condition.hull, shields: player.condition.shields },
    }),
    planetEntityId: planet.id,
    planetPosition: Object.freeze({ ...planet.location.position }),
    entryActorSlotCount: state.entryActorSlotCount,
    localGovernmentId: system?.governmentId ?? null,
    opposingGovernmentId: system?.opposingGovernmentId ?? null,
    localStanding:
      state.lifecycle.systemStanding.find(entry => entry.systemId === player.location.systemId)?.value ?? null,
    cameraZoom: state.cameraZoom,
    slotCount: slots.length,
    getWeaponDefinition: (weaponId: number) => {
      const weapon = definitions.getWeaponDefinition(weaponId);
      return weapon ? WeaponDefinitionSchema.parse(weapon) : undefined;
    },
  });
}

/** Reject the ENTIRE decision before any of it is applied: every target must
 * resolve in the active system, writes must name other live slotted actors once,
 * and emissions must name available weapons/flight capabilities. Damage arithmetic stays module-owned
 * (`rules.resolvePrimaryHit`); the engine never recomputes beam power. */
function validateDecision(state: WorldState, npc: DecisionActor, decision: NpcDecision, input: NpcPhaseInput): void {
  if (decision.combat.blameDeath !== actorCombat(npc).blameDeath)
    throw new Error('NPC decisions cannot change hit blame.');
  const fallback = actorCombat(npc).fallbackPrimaryWeaponId;
  if (fallback !== null && decision.combat.fallbackPrimaryWeaponId !== fallback)
    throw new Error('Fallback weapon is write-once.');
  if (
    decision.combat.fallbackPrimaryWeaponId !== null &&
    !input.definitions.getWeaponDefinition(decision.combat.fallbackPrimaryWeaponId)
  )
    throw new Error('Unknown fallback weapon.');
  if (decision.departure && npc.kind === 'station') throw new Error('Stations cannot depart.');
  if (state.projectiles.length + decision.projectileShots.length > 1024) throw new Error('Projectile limit exceeded.');
  decision.projectileShots.forEach(shot => {
    validateTarget(state, shot.targetEntityId, npc.id);
    if (!input.definitions.getWeaponDefinition(shot.weaponDefinitionId)) throw new Error('Unknown projectile weapon.');
    validateProjectileCapability(input.rules, input.combatGeometry, shot.weaponDefinitionId);
  });
  const systemId = selectPlayerEntity(state).location.systemId;
  validateTarget(state, decision.targetEntityId, npc.id);
  const writeIds = new Set(decision.actorWrites.map(write => write.actorId));
  if (writeIds.size !== decision.actorWrites.length) throw new Error('Duplicate NPC decision actor write.');
  decision.actorWrites.forEach(write => {
    const actor = selectWorldEntity(state, write.actorId);
    if (
      write.actorId === npc.id ||
      !actor ||
      !isDecisionActor(actor) ||
      actor.location.systemId !== systemId ||
      !state.specialActorSlots.includes(write.actorId)
    )
      throw new Error('NPC decision write requires another active slotted actor.');
    validateTarget(state, write.targetEntityId, write.actorId);
  });
  decision.beamShots.forEach(shot => {
    validateTarget(state, shot.targetEntityId, npc.id);
    if (!input.definitions.getWeaponDefinition(shot.weaponDefinitionId))
      throw new Error('NPC beam names an unknown weapon.');
  });
}

/** Apply the actor's own state, its writes to other ships and its notice. */
function applyDecisionState(state: WorldState, npc: DecisionActor, decision: NpcDecision): WorldState {
  const player = selectPlayerEntity(state);
  const notice = decision.notice
    ? PlayerNoticeSchema.parse({ ...decision.notice, sequence: (player.feedback.notice?.sequence ?? 0) + 1 })
    : null;
  return freezeWorld({
    ...state,
    entities: state.entities.map(actor => {
      if (actor.id === npc.id)
        return withActorDecisionState(
          npc,
          decision.combat,
          { targetEntityId: decision.targetEntityId, targetOffset: decision.targetOffset },
          decision.randomState
        );
      if (actor.kind === 'player-ship' && notice) return { ...actor, feedback: { ...actor.feedback, notice } };
      const write = decision.actorWrites.find(candidate => candidate.actorId === actor.id);
      if (!isDecisionActor(actor) || !write) return actor;
      return withActorDecisionState(
        actor,
        { ...actorCombat(actor), alert: write.alert },
        { ...actorNavigation(actor), targetEntityId: write.targetEntityId }
      );
    }),
  });
}

/** Record one beam for presentation and, when it targets the player, settle it
 * immediately through the module hit rule and the guarded durability commit.
 * Ship and station victims use the same hit/death owner as player fire.
 * Planets have no durability and only produce presentation history. */
function settleBeam(
  state: WorldState,
  npc: DecisionActor,
  vessel: EntityDefinition,
  shot: NpcDecision['beamShots'][number],
  { rules, definitions, systems = [], lifecycle, progression }: NpcPhaseInput
): WorldState {
  if (state.status !== 'active') return state;
  const victim = selectWorldEntity(state, shot.targetEntityId);
  if (!victim || (victim.kind === 'npc-ship' && victim.condition.hull === 0)) return state;
  const event = NpcBeamEventSchema.parse({
    ...shot,
    tick: state.tick,
    emitterEntityId: npc.id,
    origin: npc.location.position,
    targetPosition: victim.location.position,
  });
  const emitted = freezeWorld({ ...state, npcBeamEvents: NpcBeamEventsSchema.parse([...state.npcBeamEvents, event]) });
  const weapon = definitions.getWeaponDefinition(shot.weaponDefinitionId)!;
  if (victim.kind === 'npc-ship' || victim.kind === 'station') {
    const catalog = createLifecycleDefinitions(definitions);
    const hit = prepareActorHit(
      emitted,
      victim.id,
      { kind: 'npc', id: npc.id, sizeClass: actorSize(vessel) },
      actorSize(vessel),
      weapon,
      selectPlayerEntity(emitted).location.position,
      emitted.cameraZoom,
      rules,
      catalog,
      systems,
      lifecycle
    );
    return applyLifecycleHit(emitted, hit, catalog, progression);
  }
  if (victim.kind !== 'player-ship') return emitted;
  return commitPlayerDurability(
    emitted,
    rules.resolvePrimaryHit(
      Object.freeze({
        attacker: Object.freeze({ sizeClass: actorSize(vessel) }),
        weapon: Object.freeze({ id: weapon.id, baseDamage: weapon.baseDamage }),
        target: Object.freeze({
          condition: Object.freeze({ hull: victim.condition.hull, shields: victim.condition.shields }),
        }),
      })
    )
  );
}

/** Decide, validate and settle one actor against the current sequential state. */
function decideActor(
  state: WorldState,
  id: string,
  input: NpcPhaseInput,
  slots: readonly (NpcDecisionSlot | null)[],
  selectedTargetEntityId: string | null
): WorldState {
  const decide = input.rules.decideNpcCombat;
  if (state.status !== 'active' || !decide) return state;
  const npc = selectWorldEntity(state, id);
  if (!npc || !isDecisionActor(npc)) return state;
  const vessel =
    npc.kind === 'npc-ship'
      ? input.definitions.getShipDefinition(npc.definitionId)
      : input.definitions.getEntityDefinition?.(npc.definitionId);
  if (!vessel) throw new Error(`NPC ${npc.id} has an invalid vessel reference.`);
  const result = decide(createDecisionContext(state, npc, vessel, input, slots, selectedTargetEntityId));
  if (result === null) return state;
  const decision = NpcDecisionSchema.parse(result);
  validateDecision(state, npc, decision, input);
  const applied = applyDecisionState(state, npc, decision);
  const emitted = decision.projectileShots.reduce((candidate, shot) => {
    const projectile = createProjectile(candidate, {
      ...shot,
      emitterEntityId: npc.id,
      emitterDefinitionId: npc.definitionId,
      systemId: npc.location.systemId,
      position: npc.location.position,
      spawnedTick: candidate.tick,
    });
    return freezeWorld({
      ...candidate,
      nextEntitySequence: candidate.nextEntitySequence + 1,
      projectiles: [...candidate.projectiles, projectile],
    });
  }, applied);
  const settled = decision.beamShots.reduce(
    (candidate, shot) => settleBeam(candidate, npc, vessel, shot, input),
    emitted
  );
  if (settled.status !== 'active' || !decision.departure) return settled;
  return departActor(settled, npc.id, decision.departure);
}

/** Apply the movement pass and the deferred engine-disable countdown. */
function applyNpcMovement(
  state: WorldState,
  { definitions, rules }: NpcPhaseInput,
  originalIds: ReadonlySet<string>
): WorldState {
  const updates = advanceNpcNavigation(state, definitions, rules, state.cameraZoom, originalIds);
  return freezeWorld({
    ...state,
    entities: state.entities.map(actor => {
      if (actor.kind !== 'npc-ship' || !originalIds.has(actor.id)) return actor;
      const update = updates.find(candidate => candidate.id === actor.id)!;
      return {
        ...actor,
        randomState: update.randomState ?? actor.randomState,
        location: {
          ...actor.location,
          position: update.movement.position,
          rotationDegrees: update.movement.rotationDegrees,
        },
        motion: update.movement.motion,
        navigation: { ...actor.navigation, targetOffset: update.movement.targetOffset },
        specialStatus: {
          ...actor.specialStatus,
          hitFlag: 0,
          engineDisabledFrames: Math.max(0, actor.specialStatus.engineDisabledFrames - 1),
        },
      };
    }),
  });
}

/** Operates on the detached, committed player-phase candidate. Original IDs are
 * captured before player fire: new lifecycle replacements wait until next tick.
 * Slot NPCs run first (holes retained), then unslotted NPCs in entity order.
 * Removed actors never run. All decisions/fire finish before any actor moves;
 * movement continues each actor's returned stream, never the world stream.
 * A terminal incoming hit returns at once: nothing else mutates that tick. */
export function advanceNpcCombat(
  world: WorldState,
  input: NpcPhaseInput,
  originalIds: ReadonlySet<string>
): WorldState {
  if (world.status !== 'active') return world;
  let slots = projectDecisionSlots(world, input.systems);
  const actors = world.entities.filter(isDecisionActor).map(actor => actor.id);
  const slotted = world.specialActorSlots.filter((id): id is string => id !== null && actors.includes(id));
  const decided = [...slotted, ...actors.filter(id => !slotted.includes(id))]
    .filter(id => originalIds.has(id))
    .reduce(
      (state, id) => {
        // Selection is an input fact for this phase even if an earlier decision
        // removes that target. Current slots still expose its absence to policy.
        const next = decideActor(state, id, input, slots, world.selectedTargetEntityId);
        slots = projectDecisionSlots(next, input.systems, slots);
        return next;
      },
      freezeWorld({ ...world, npcBeamEvents: [] })
    );
  if (decided.status !== 'active') return decided;
  return applyNpcMovement(decided, input, originalIds);
}
