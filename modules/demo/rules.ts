/**
 * Simple navigation authored for the demonstration module. Opposing inputs
 * cancel, speed is capped at the vessel limit, and turning has no speed tiers.
 * This module does not import compatibility rules or recovered evidence.
 */
import type { GameRules } from '../../src/simulation/contracts/game-rules';
import { freezeNpcMovementState } from '../../src/simulation/model/npc-state';
import { freezePlayerMovementState } from '../../src/simulation/model/player-state';
import { evaluateRepairStart, updateRepair } from './repair';

export const rules: GameRules = Object.freeze<GameRules>({
  apiVersion: 9,
  moduleId: 'demo',
  updatePlayerMovement: (player, vessel, controls) => {
    const throttle = Number(controls.accelerate) - Number(controls.decelerate);
    const steering = Number(controls.turnRight) - Number(controls.turnLeft);
    const canAccelerate = throttle <= 0 || player.energy > 0;
    const speed = player.repairing || !canAccelerate ? player.speedPerFrame
      : Math.max(-vessel.maximumSpeedPerFrame, Math.min(0, player.speedPerFrame - throttle * 0.5));
    const rotation = player.repairing ? player.rotationDegrees
      : ((player.rotationDegrees + steering * vessel.turnDegreesPerFrame) % 360 + 360) % 360;
    const heading = rotation * Math.PI / 180;
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
    movement: freezeNpcMovementState({ ...npc,
      position: { x: npc.position.x, y: npc.position.y - Math.min(1, vessel.maximumSpeedPerFrame) },
      motion: Object.freeze({ ...npc.motion, speedPerFrame: Math.min(1, vessel.maximumSpeedPerFrame) }),
    }),
  }),
  // The independent fixture uses a circular range and an unscaled cooldown.
  evaluatePrimaryFire: ({ player, weapon, target }) => {
    if (player.repairing || player.flightMode === 'warp' || player.energy < weapon.energyCost) return null;
    const dx = target.position.x - player.position.x;
    const dy = target.position.y - player.position.y;
    if (dx * dx + dy * dy > 120 * 120) return null;
    return Object.freeze({ cooldownFramesBeforeEndOfTick: weapon.cooldownFrames });
  },
  // Independent policy: the nonlethal survey pulse drains shields only and
  // discards excess, unlike BM1's shield-to-hull overflow and size scaling.
  resolvePrimaryHit: ({ weapon, target }) => Object.freeze({
    hull: target.condition.hull,
    shields: Math.max(0, target.condition.shields - weapon.baseDamage),
  }),
  evaluateRepairStart,
  updateRepair,
  // Independent circular route metric, unlike BM1's Manhattan distance.
  estimateTravel: ({ origin, destination, vessel }) => {
    const distance = Math.hypot(destination.x - origin.x, destination.y - origin.y);
    return Object.freeze({ durationDays: Math.ceil(distance / 12), advanceDays: Math.ceil(distance / 12), fuelResourceId: 'fuel',
      fuelUnits: Math.ceil(distance / (20 * vessel.fuelEfficiency)) });
  },
  canDepart: ({ estimate, fuelBalance }) => fuelBalance >= estimate.fuelUnits,
});
