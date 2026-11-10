/**
 * Simple navigation authored for the demonstration module. Opposing inputs
 * cancel, speed is capped at the vessel limit, and turning has no speed tiers.
 * This module does not import compatibility rules or recovered evidence.
 */
import { nextRandomUnit } from '@engine/random/seeded-random';
import type { GameRules } from '@engine/simulation/contracts/game-rules';
import { freezeNpcMovementState } from '@engine/simulation/model/npc-state';
import { freezePlayerMovementState } from '@engine/simulation/model/player-state';
import { createCargoMarket, planCargoTransfer, quoteResourceSale } from './cargo-rules';
import { createVisitEncounter } from './encounter-rules';
import { missions } from './mission-rules';
import { decideNpcCombat, respondToPlayerShot } from './npc-combat';
import { advanceProjectileMotion, getProjectileFlight } from './projectiles';
import { evaluateRepairStart, updateRepair } from './repair';
import { getSpecialWeapon } from './special-devices';
import { resolveStationMembership, validateStationMembership } from './station-membership';

export const rules: GameRules = Object.freeze<GameRules>({
  apiVersion: 29,
  createVisitEncounter,
  decideNpcCombat,
  respondToPlayerShot,
  missions,
  resolveProgression: event => {
    if (event.kind !== 'travel-departure') return null;
    const step = nextRandomUnit(event.randomState);
    return {
      delta: { experience: { pathfinding: 2, fieldcraft: step.value }, tallies: { journeys: 1 } },
      randomState: step.state,
    };
  },
  createCargoMarket,
  planCargoTransfer,
  quoteResourceSale,
  validateEquipmentMarket: (_system, adjustment) => adjustment === 0,
  evaluateEquipmentPrice: ({ operation }) =>
    Object.freeze({
      resourceId: 'credits',
      amount: operation === 'sell' ? 2 : 3,
      minimumBalance: operation === 'sell' ? 0 : 3,
    }),
  getSpecialWeapon,
  selectSpecialEffectSlots: ({ actorSpawnSlots }) => actorSpawnSlots,
  getProjectileFlight,
  advanceProjectileMotion,
  // Independent fixed-fee refit, paid in credits, with no fuel refill.
  evaluateVesselPurchase: ({ nextVessel, playerPosition, planetPosition }) =>
    Math.hypot(playerPosition.x - planetPosition.x, playerPosition.y - planetPosition.y) > 500
      ? null
      : {
          resourceId: 'credits',
          cost: 25,
          minimumBalance: 25,
          energy: nextVessel.cargoCapacity * 2,
          rotationDegrees: 0,
          motion: { speedPerFrame: 0, flightMode: 'impulse' },
          refill: null,
          notice: { code: 'vessel-refitted', message: 'Vessel refit complete.' },
        },
  moduleId: 'demo',
  updatePlayerMovement: (player, vessel, controls) => {
    const throttle = Number(controls.accelerate) - Number(controls.decelerate);
    const steering = Number(controls.turnRight) - Number(controls.turnLeft);
    const canAccelerate = throttle <= 0 || player.energy > 0;
    const speed =
      player.repairing || !canAccelerate
        ? player.speedPerFrame
        : Math.max(-vessel.maximumSpeedPerFrame, Math.min(0, player.speedPerFrame - throttle * 0.5));
    const rotation = player.repairing
      ? player.rotationDegrees
      : (((player.rotationDegrees + steering * vessel.turnDegreesPerFrame) % 360) + 360) % 360;
    const heading = (rotation * Math.PI) / 180;
    return freezePlayerMovementState({
      ...player,
      flightMode: 'impulse',
      speedPerFrame: speed,
      rotationDegrees: rotation,
      position: { x: player.position.x - Math.sin(heading) * speed, y: player.position.y + Math.cos(heading) * speed },
    });
  },
  // Independent policy: fixed placement and station intent, unlike BM1's
  // randomized planet-seeking encounter.
  createStartingNpc: context => {
    if (context.encounterId !== 'station-patrol') throw new Error(`Unknown demo encounter ${context.encounterId}.`);
    const station = context.targetCandidates.find(candidate => candidate.kind === 'station');
    if (!station) throw new Error('The station patrol requires a station target.');
    return Object.freeze({
      position: Object.freeze({ x: context.playerPosition.x + 72, y: context.playerPosition.y + 48 }),
      targetEntityId: station.id,
      targetOffset: Object.freeze({ x: 24, y: -12 }),
      randomState: context.seed,
    });
  },
  // Independent steering: the NPC cruises upward without random draws.
  updateNpcMovement: (npc, vessel, _target, _zoom, randomState) => ({
    randomState,
    movement: freezeNpcMovementState({
      ...npc,
      position: { x: npc.position.x, y: npc.position.y - Math.min(1, vessel.maximumSpeedPerFrame) },
      motion: Object.freeze({ ...npc.motion, speedPerFrame: Math.min(1, vessel.maximumSpeedPerFrame) }),
    }),
  }),
  // The independent fixture uses a circular range and an unscaled cooldown.
  evaluatePrimaryFire: ({ player, weapon, target }) => {
    if (getSpecialWeapon(weapon.id)) {
      if (player.repairing || player.flightMode === 'warp' || player.energy < weapon.energyCost) return null;
      if (
        weapon.id === 105 &&
        (!target || Math.hypot(target.position.x - player.position.x, target.position.y - player.position.y) > 200)
      )
        return null;
      return Object.freeze({ cooldownFramesBeforeEndOfTick: weapon.cooldownFrames });
    }
    if (!target) return null;
    if (player.repairing || player.flightMode === 'warp' || player.energy < weapon.energyCost) return null;
    const dx = target.position.x - player.position.x;
    const dy = target.position.y - player.position.y;
    if (dx * dx + dy * dy > 120 * 120) return null;
    return Object.freeze({ cooldownFramesBeforeEndOfTick: weapon.cooldownFrames });
  },
  // Independent policy: size-one survey pulses drain shields and discard
  // excess. Larger archive craft also retire hull directly, without overflow.
  resolvePrimaryHit: ({ attacker, weapon, target }) =>
    Object.freeze({
      hull: attacker.sizeClass >= 2 ? Math.max(0, target.condition.hull - weapon.baseDamage) : target.condition.hull,
      shields: Math.max(0, target.condition.shields - weapon.baseDamage),
    }),
  // Authored survey settlement: each retired station costs seven district
  // strength and dispatches two deterministic unarmed archive drones. This
  // deliberately differs from government/size-dependent replacement policies.
  resolveStationHit: ({ weapon, target }) => Math.max(0, target.strength - weapon.baseDamage),
  resolveStationMembership,
  validateStationMembership,
  resolveLifecycleHit: context => {
    if (context.actor.kind === 'npc-ship') {
      // Independent archive policy: retire traffic without prestige, strength,
      // replacement or captain draws; count completed records only at death.
      return {
        playerAttributed: context.actor.targetsPlayer,
        blameDeath: context.actor.blameDeath,
        randomState: context.randomState,
        stationMembershipUpdates: [],
        standingUpdates: [],
        strengthUpdates: [],
        spawns: [],
        communication: null,
        tallyDelta: context.actor.remainingStrength === 0 ? { journeys: 1 } : {},
        notice:
          context.actor.remainingStrength === 0
            ? { code: 'traffic-retired', message: 'A traffic record has been archived.' }
            : null,
      };
    }
    return {
      playerAttributed: true,
      blameDeath: false,
      randomState: context.randomState,
      stationMembershipUpdates:
        context.actor.remainingStrength === 0 && context.actor.stationRecordId
          ? resolveStationMembership({
              stationRecordId: context.actor.stationRecordId,
              stationMembershipOverrides: context.stationMembershipOverrides,
            })
          : [],
      // Offscreen districts are consumed standing scopes, never destinations.
      // The shared boundary guarantees the complete frozen collection; missing
      // values must fail rather than silently becoming zero.
      standingUpdates:
        context.actor.remainingStrength === 0
          ? [
              { systemId: 3, change: 2 },
              { systemId: 41, change: 5 },
              { systemId: 82, change: -3 },
            ].map(({ systemId, change }) => {
              const prior = context.systemStanding.find(entry => entry.systemId === systemId);
              if (!prior) throw new Error(`Missing demo standing scope ${systemId}.`);
              return { systemId, value: prior.value + change };
            })
          : [],
      strengthUpdates:
        context.actor.remainingStrength === 0 && context.system.id === 3
          ? [{ systemId: context.system.id, value: context.system.strength! - 7 }]
          : [],
      communication:
        context.actor.remainingStrength === 0
          ? {
              code: 'survey-archive',
              message: 'Archive collection is ready. Two survey drones will preserve the completed platform records.',
            }
          : null,
      spawns:
        context.actor.remainingStrength === 0
          ? [0, 1].map(index => ({
              definitionId: 1,
              position: { x: context.playerPosition.x + 30 + index * 20, y: context.playerPosition.y - 30 },
              rotationDegrees: 0,
              targetEntityId: context.planetEntityId,
              governmentId: 1,
              raceId: 1,
              name: index === 0 ? 'Archive Moth' : 'Archive Wren',
            }))
          : [],
      notice:
        context.actor.remainingStrength === 0
          ? { code: 'actor-destroyed', message: 'The research platform has been retired from this survey.' }
          : null,
    };
  },
  validateGeneratedActor: ({ definitionId, systemId, generation }) =>
    definitionId === 1 &&
    [3, 4].includes(systemId) &&
    generation.policyId === 'survey-retirement' &&
    generation.governmentId === 1 &&
    generation.raceId === 1 &&
    ['Archive Moth', 'Archive Wren'].includes(generation.name),
  evaluateRepairStart,
  updateRepair,
  // Independent circular route metric, unlike BM1's Manhattan distance.
  estimateTravel: ({ origin, destination, vessel }) => {
    const distance = Math.hypot(destination.x - origin.x, destination.y - origin.y);
    return Object.freeze({
      durationDays: Math.ceil(distance / 12),
      advanceDays: Math.ceil(distance / 12),
      fuelResourceId: 'fuel',
      fuelUnits: Math.ceil(distance / (20 * vessel.fuelEfficiency)),
    });
  },
  // The basin route unlocks after one ordinary journey.
  canDepart: ({ destinationSystemId, progression, estimate, fuelBalance }) =>
    fuelBalance >= estimate.fuelUnits && (destinationSystemId !== 4 || (progression?.experience.pathfinding ?? 0) >= 2),
});
