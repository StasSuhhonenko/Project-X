/** Authoritative projectile allocation for every emitter, flight and delayed impact.
 * Module rules provide immutable motion; all publication remains one tick. */
import type { GameModuleDefinition } from '../../content/schemas/game-module';
import type { GameRules } from '../contracts/game-rules';
import { ProjectileFlightDefinitionSchema, ProjectileMotionSchema } from '../contracts/projectile-rules';
import { actorSize } from '../model/decision-actor';
import type { PlayerMovementState } from '../model/player-state';
import { ProjectileStateSchema, type ProjectileState } from '../model/projectile-state';
import { freezeWorld } from '../model/world-schema';
import { selectPlayerEntity, selectWorldEntity, type PrimaryWeaponState, type WorldState } from '../model/world-state';
import type { WorldTickDefinitions } from './advance-world';
import { commitPlayerDurability } from './destruction';
import { applyLifecycleHit, createLifecycleDefinitions, prepareActorHit } from './lifecycle-hit';
import { projectileOverlapsTarget } from './projectile-collision';

/** A newly accepted sequence becomes exactly one allocated projectile, without
 * impact. Aim reads the same pre-NPC-motion snapshot as the command gate. */
export function createPrimaryProjectile(
  world: WorldState,
  player: PlayerMovementState,
  armament: PrimaryWeaponState,
  rules: GameRules,
  combatGeometry: GameModuleDefinition['combatGeometry'] | undefined,
  previousSequence = selectPlayerEntity(world).armament.shotSequence
): ProjectileState | null {
  const shot = armament.lastAcceptedShot;
  if (!shot || shot.sequence <= previousSequence) return null;
  const input = rules.getProjectileFlight?.(shot.weaponDefinitionId);
  if (!input) return null;
  const definition = validateProjectileCapability(rules, combatGeometry, shot.weaponDefinitionId);
  const target = shot.targetEntityId === null ? null : selectWorldEntity(world, shot.targetEntityId);
  if (definition.launch === 'target' && !target) throw Error('Aimed projectile target disappeared before launch.');
  const rotationDegrees =
    definition.launch === 'target' && target
      ? Math.round(
          (Math.atan2(target.location.position.y - player.position.y, target.location.position.x - player.position.x) *
            180) /
            Math.PI
        ) + 90
      : player.rotationDegrees;
  const emitter = selectPlayerEntity(world);
  return createProjectile(world, {
    emitterEntityId: emitter.id,
    emitterDefinitionId: emitter.definitionId,
    weaponDefinitionId: shot.weaponDefinitionId,
    targetEntityId: shot.targetEntityId,
    systemId: emitter.location.systemId,
    position: player.position,
    rotationDegrees,
    launchSpeedPerFrame: Math.abs(player.speedPerFrame),
    spawnedTick: world.tick + 1,
  });
}

interface Environment {
  readonly rules: GameRules;
  readonly definitions: WorldTickDefinitions;
  readonly systems: GameModuleDefinition['systems'];
  readonly combatGeometry: GameModuleDefinition['combatGeometry'] | undefined;
  readonly lifecycle: GameModuleDefinition['lifecycle'];
  readonly progression?: GameModuleDefinition['progression'];
}

function impact(world: WorldState, projectile: ProjectileState, environment: Environment): WorldState {
  if (projectile.targetEntityId === null) return world;
  const target = selectWorldEntity(world, projectile.targetEntityId);
  if (!target || (target.kind !== 'npc-ship' && target.kind !== 'station' && target.kind !== 'player-ship'))
    return world;
  const { definitions, rules, systems, lifecycle } = environment;
  const emitter =
    definitions.getEntityDefinition?.(projectile.emitterDefinitionId) ??
    definitions.getShipDefinition(projectile.emitterDefinitionId);
  const weapon = definitions.getWeaponDefinition(projectile.weaponDefinitionId);
  if (!emitter || !weapon) throw Error('Projectile impact definitions are unavailable.');
  const sizeClass = actorSize(emitter);
  if (target.kind === 'player-ship')
    return commitPlayerDurability(
      world,
      rules.resolvePrimaryHit(
        Object.freeze({
          attacker: Object.freeze({ sizeClass }),
          weapon: Object.freeze({ id: weapon.id, baseDamage: weapon.baseDamage }),
          target: Object.freeze({
            condition: Object.freeze({ hull: target.condition.hull, shields: target.condition.shields }),
          }),
        })
      )
    );
  const lifecycleDefinitions = createLifecycleDefinitions(definitions);
  const hit = prepareActorHit(
    world,
    target.id,
    projectile.emitterEntityId === world.playerEntityId
      ? { kind: 'player' }
      : { kind: 'npc', id: projectile.emitterEntityId, sizeClass },
    sizeClass,
    weapon,
    selectPlayerEntity(world).location.position,
    world.cameraZoom,
    rules,
    lifecycleDefinitions,
    systems,
    lifecycle
  );
  return applyLifecycleHit(world, hit, lifecycleDefinitions, environment.progression);
}

/** Stable allocation-order settlement is sequential because a prior impact
 * may remove a target or change lifecycle/RNG facts consumed by the next one. */
export function advanceProjectiles(world: WorldState, environment: Environment): WorldState {
  if (world.projectiles.length === 0) return world;
  const { rules, combatGeometry } = environment;
  if (!combatGeometry || !rules.getProjectileFlight || !rules.advanceProjectileMotion)
    throw Error('Projectile support is unavailable.');
  return world.projectiles.reduce((state, projectile) => {
    if (state.status !== 'active' || projectile.spawnedTick === state.tick) return state;
    const definition = ProjectileFlightDefinitionSchema.parse(
      rules.getProjectileFlight!(projectile.weaponDefinitionId)
    );
    const replace = (next: ProjectileState | null) =>
      freezeWorld({
        ...state,
        projectiles: state.projectiles.flatMap(current =>
          current.id !== projectile.id ? [current] : next ? [next] : []
        ),
      });
    if (projectile.impactAgeTicks !== null) {
      const age = projectile.impactAgeTicks + 1;
      if (age >= definition.impactDurationTicks) return replace(null);
      const next = replace(ProjectileStateSchema.parse({ ...projectile, impactAgeTicks: age }));
      return age === definition.impactDelayTicks ? impact(next, projectile, environment) : next;
    }
    if (projectile.ageTicks >= definition.maximumAgeTicks) return replace(null);
    const target = projectile.targetEntityId === null ? null : selectWorldEntity(state, projectile.targetEntityId);
    const collides = (candidate: ProjectileState) =>
      Boolean(
        target &&
        (target.kind === 'npc-ship' || target.kind === 'station' || target.kind === 'player-ship') &&
        projectileOverlapsTarget(candidate, target, combatGeometry)
      );
    if (collides(projectile)) return replace(ProjectileStateSchema.parse({ ...projectile, impactAgeTicks: 0 }));
    const motion = ProjectileMotionSchema.parse(
      rules.advanceProjectileMotion!({ projectile, definition, targetPosition: target?.location.position ?? null })
    );
    const moved = ProjectileStateSchema.parse({ ...projectile, ...motion });
    return replace(
      definition.collisionAfterMove && collides(moved)
        ? ProjectileStateSchema.parse({ ...moved, impactAgeTicks: 0 })
        : moved
    );
  }, world);
}

/** Validate the flight/geometry seam before accepting any emission. */
export function validateProjectileCapability(
  rules: GameRules,
  geometry: GameModuleDefinition['combatGeometry'] | undefined,
  weaponId: number
) {
  const flight = rules.getProjectileFlight?.(weaponId);
  if (
    !flight ||
    !rules.advanceProjectileMotion ||
    !geometry?.projectiles.some(visual => visual.weaponDefinitionId === weaponId)
  )
    throw Error('Projectile motion or visual capability is unavailable.');
  return ProjectileFlightDefinitionSchema.parse(flight);
}

/** Sole projectile allocation constructor. Caller publishes the returned shot
 * with exactly one allocator increment in its enclosing atomic transaction. */
export function createProjectile(
  world: WorldState,
  emission: Omit<ProjectileState, 'id' | 'ageTicks' | 'impactAgeTicks'>
): ProjectileState {
  if (!Number.isSafeInteger(world.nextEntitySequence + 1)) throw Error('Projectile allocator overflow.');
  return ProjectileStateSchema.parse({
    ...emission,
    id: `entity-${world.nextEntitySequence}`,
    ageTicks: 0,
    impactAgeTicks: null,
  });
}
