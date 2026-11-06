/** Authoritative player projectile allocation, flight and delayed impact.
 * Module rules provide immutable motion; all publication remains one tick. */
import type { GameModuleDefinition } from '../../content/schemas/game-module';
import type { GameRules } from '../contracts/game-rules';
import { ProjectileFlightDefinitionSchema, ProjectileMotionSchema } from '../contracts/projectile-rules';
import { ProjectileStateSchema, type ProjectileState } from '../model/projectile-state';
import type { PlayerMovementState } from '../model/player-state';
import { freezeWorld } from '../model/world-schema';
import { selectPlayerEntity, selectWorldEntity, type PrimaryWeaponState, type WorldState } from '../model/world-state';
import type { WorldTickDefinitions } from './advance-world';
import { prepareLifecycleHit, applyLifecycleHit } from './lifecycle-hit';
import { resolvePrimaryHit } from './primary-hit';
import { settleNpcDestruction } from './destruction';
import { projectileOverlapsTarget } from './projectile-collision';

/** A newly accepted sequence becomes exactly one allocated projectile, without
 * impact. Aim reads the same pre-NPC-motion snapshot as the command gate. */
export function createPrimaryProjectile(world:WorldState,player:PlayerMovementState,armament:PrimaryWeaponState,
  rules:GameRules,combatGeometry:GameModuleDefinition['combatGeometry']|undefined, previousSequence = selectPlayerEntity(world).armament.shotSequence):ProjectileState|null {
  const shot=armament.lastAcceptedShot;
  if (!shot || shot.sequence<=previousSequence) return null;
  const input=rules.getProjectileFlight?.(shot.weaponDefinitionId);
  if (!input) return null;
  const definition=ProjectileFlightDefinitionSchema.parse(input);
  if (!rules.advanceProjectileMotion || !combatGeometry?.projectiles.some(visual=>visual.weaponDefinitionId===shot.weaponDefinitionId))
    throw Error('Projectile motion or visual capability is unavailable.');
  const target=shot.targetEntityId===null?null:selectWorldEntity(world,shot.targetEntityId);
  if (definition.launch==='target' && !target) throw Error('Aimed projectile target disappeared before launch.');
  const rotationDegrees=definition.launch==='target' && target
    ? Math.round(Math.atan2(target.location.position.y-player.position.y,target.location.position.x-player.position.x)*180/Math.PI)+90
    : player.rotationDegrees;
  const emitter=selectPlayerEntity(world);
  return ProjectileStateSchema.parse({id:`entity-${world.nextEntitySequence}`,
    emitterEntityId:emitter.id,emitterDefinitionId:emitter.definitionId,weaponDefinitionId:shot.weaponDefinitionId,
    targetEntityId:shot.targetEntityId,systemId:emitter.location.systemId,position:player.position,rotationDegrees,
    launchSpeedPerFrame:Math.abs(player.speedPerFrame),spawnedTick:world.tick+1,ageTicks:0,impactAgeTicks:null});
}

interface Environment {
  readonly rules:GameRules;
  readonly definitions:WorldTickDefinitions;
  readonly systems:GameModuleDefinition['systems'];
  readonly combatGeometry:GameModuleDefinition['combatGeometry']|undefined;
  readonly lifecycle:GameModuleDefinition['lifecycle'];
}

function impact(world:WorldState,projectile:ProjectileState,environment:Environment):WorldState {
  if (projectile.targetEntityId===null) return world;
  const target=selectWorldEntity(world,projectile.targetEntityId);
  if (!target || (target.kind!=='npc-ship' && target.kind!=='station')) return world;
  const {definitions,rules,systems,lifecycle}=environment;
  const vessel=definitions.getShipDefinition(projectile.emitterDefinitionId);
  const weapon=definitions.getWeaponDefinition(projectile.weaponDefinitionId);
  if (!vessel || !weapon) throw Error('Projectile impact definitions are unavailable.');
  // This local hit intent reuses the existing damage/settlement boundary. It
  // never replaces current equipment, primary history or the player's hull.
  const armament:PrimaryWeaponState={weaponDefinitionId:weapon.id,cooldownRemainingFrames:0,
    shotSequence:1,resolvedShotSequence:0,lastAcceptedShot:{sequence:1,weaponDefinitionId:weapon.id,
      targetEntityId:target.id,tick:world.tick}};
  const lifecycleDefinitions={
    getEntityDefinition:(id:number)=>definitions.getEntityDefinition?.(id)??definitions.getShipDefinition(id),
    getShipDefinition:definitions.getShipDefinition,
  };
  const hit=prepareLifecycleHit(world,armament,vessel,weapon,selectPlayerEntity(world).location.position,
    world.cameraZoom,rules,lifecycleDefinitions,systems,lifecycle);
  if (hit) return applyLifecycleHit(world,hit,lifecycleDefinitions);
  const ordinary=resolvePrimaryHit(world,armament,vessel,weapon,rules);
  const update=ordinary.npcDurabilityUpdates[0];
  if (!update) return world;
  return settleNpcDestruction(freezeWorld({...world,entities:world.entities.map(entity=>
    entity.id===update.id && entity.kind==='npc-ship'?{...entity,condition:update.condition}:entity)}));
}

/** Stable allocation-order settlement is sequential because a prior impact
 * may remove a target or change lifecycle/RNG facts consumed by the next one. */
export function advanceProjectiles(world:WorldState,environment:Environment):WorldState {
  if (world.projectiles.length===0) return world;
  const {rules,combatGeometry}=environment;
  if (!combatGeometry || !rules.getProjectileFlight || !rules.advanceProjectileMotion) throw Error('Projectile support is unavailable.');
  return world.projectiles.reduce((state,projectile)=>{
    if (projectile.spawnedTick===state.tick) return state;
    const definition=ProjectileFlightDefinitionSchema.parse(rules.getProjectileFlight!(projectile.weaponDefinitionId));
    const replace=(next:ProjectileState|null)=>freezeWorld({...state,projectiles:state.projectiles.flatMap(current=>
      current.id!==projectile.id?[current]:next?[next]:[])});
    if (projectile.impactAgeTicks!==null) {
      const age=projectile.impactAgeTicks+1;
      if (age>=definition.impactDurationTicks) return replace(null);
      const next=replace(ProjectileStateSchema.parse({...projectile,impactAgeTicks:age}));
      return age===definition.impactDelayTicks?impact(next,projectile,environment):next;
    }
    if (projectile.ageTicks>=definition.maximumAgeTicks) return replace(null);
    const target=projectile.targetEntityId===null?null:selectWorldEntity(state,projectile.targetEntityId);
    const collides=(candidate:ProjectileState)=>Boolean(target && (target.kind==='npc-ship'||target.kind==='station')
      && projectileOverlapsTarget(candidate,target,combatGeometry));
    if (collides(projectile)) return replace(ProjectileStateSchema.parse({...projectile,impactAgeTicks:0}));
    const motion=ProjectileMotionSchema.parse(rules.advanceProjectileMotion!({projectile,definition,targetPosition:target?.location.position??null}));
    const moved=ProjectileStateSchema.parse({...projectile,...motion});
    return replace(definition.collisionAfterMove && collides(moved)
      ? ProjectileStateSchema.parse({...moved,impactAgeTicks:0}):moved);
  },world);
}
