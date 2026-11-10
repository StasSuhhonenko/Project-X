/**
 * Evidence-based fixed-frame navigation for the player vessel.
 *
 * Provenance: `analysis/bm1/scripts/Symbol-2-6202.as`, navigation and
 * `locx`/`locy` sections. The Flash game held the ship at screen center and
 * translated the world. The port stores the inverse translation as a world
 * position, which gives the same camera-relative motion.
 */
import { nextRandomInteger } from '@engine/random/seeded-random';
import type { PlayerControls } from '@engine/simulation/commands/player-controls';
import type {
  GameRules,
  NpcNavigationCapabilities,
  PlayerVesselCapabilities,
  StartingNpcContext,
} from '@engine/simulation/contracts/game-rules';
import {
  freezeNpcMovementState,
  type NpcCombatState,
  type NpcMovementState,
  type NpcTargetState,
  type StartingNpcPlacement,
} from '@engine/simulation/model/npc-state';
import { freezePlayerMovementState, type PlayerMovementState } from '@engine/simulation/model/player-state';
import { createCargoMarket, planCargoTransfer, quoteResourceSale } from './cargo-rules';
import { createVisitEncounter } from './encounter-rules';
import { energyCapacity } from './energy-capacity';
import { createEquipmentMarket, evaluateEquipmentPrice, validateEquipmentMarket } from './equipment-rules';
import { fleet } from './fleet-rules';
import { flightModeAt, canWarp as isWarpCapable, WARP_THRESHOLD_PER_FRAME } from './flight-mode';
import { missions } from './mission-rules';
import { decideNpcCombat, hasNpcFlightStrength, respondToPlayerShot } from './npc-combat-rules';
import { resolvePrimaryHit } from './primary-hit';
import { evaluatePrimaryFire } from './primary-weapon';
import { resolveProgression } from './progression-rules';
import { advanceProjectileMotion, getProjectileFlight } from './projectile-rules';
import { evaluateRepairStart, updateRepair } from './repair';
import { quoteResourcePurchase } from './resource-purchase';
import { rechargePlayerShields } from './shield-recharge';
import {
  PLAYER_STAGE_ANCHOR,
  sourceStageToWorld,
  worldOffsetToSourceStage,
  worldToSourceStage,
} from './source-geometry';
import { getSpecialWeapon, selectSpecialEffectSlots } from './special-weapon-rules';
import {
  resolveLifecycleHit,
  resolveStationHit,
  resolveStationMembership,
  validateGeneratedActor,
  validateStationMembership,
} from './station-lifecycle';
import { canDepart, estimateTravel } from './travel';
import { createTravelArrival } from './travel-arrival';
import { evaluateVesselPurchase } from './vessel-purchase';

const ABSOLUTE_SPEED_LIMIT_PER_FRAME = -100;
const DEGREES_TO_RADIANS = Math.PI / 180;
// `loadplayer()` initializes four operations sliders to 50. The slider UI is
// not yet part of this navigation slice, so only its source default applies.
const INITIAL_RESERVE_ALLOCATION_PERCENT = 50;
const WARP_ENERGY_COST_PER_FRAME = 0.5;
const WARP_CORE_DEVICE_ID = 21;
const ENCOUNTER_RANDOM_EXTENT = 5000;

/** Advance navigation by exactly one authored 13 fps simulation frame. */
export function updatePlayerMovement(
  player: Readonly<PlayerMovementState>,
  vessel: Readonly<PlayerVesselCapabilities>,
  controls: Readonly<PlayerControls>,
  zoom = 1
): PlayerMovementState {
  const warpThreshold = WARP_THRESHOLD_PER_FRAME / zoom;
  // Impulse-only ships stay impulse at every zoom; see flight-mode.ts.
  const canWarp = isWarpCapable(vessel.maximumSpeedPerFrame);
  const absoluteSpeedLimit = ABSOLUTE_SPEED_LIMIT_PER_FRAME / zoom;
  const canControlVessel = !player.repairing;
  // The Flash enterFrame handler settles energy before reading navigation
  // keys. Its warp cost therefore uses the previous frame's speed, not the
  // speed reached by this tick's acceleration. The recharge test occurs after
  // the cost and may exceed the nominal capacity by one recharge increment.
  let energy = player.energy;
  if (canWarp && player.speedPerFrame < warpThreshold) energy -= WARP_ENERGY_COST_PER_FRAME;
  const maximumEnergy = energyCapacity(vessel.cargoCapacity);
  if (energy < maximumEnergy) {
    const reserveRecharge = INITIAL_RESERVE_ALLOCATION_PERCENT * 0.01 * vessel.fuelEfficiency;
    energy += (vessel.ownedWeaponIds ?? vessel.startingWeaponIds).includes(WARP_CORE_DEVICE_ID)
      ? reserveRecharge * 2
      : reserveRecharge;
  }
  const powerFailed = energy < 0;
  if (powerFailed) energy = 0;
  // Flash writes this information-panel text and leaves it until another
  // message replaces it. Sequence lets a future audio adapter react once.
  const notice = powerFailed
    ? {
        sequence: (player.notice?.sequence ?? 0) + 1,
        code: 'power-failure',
        message: 'Warning: Power Failure.',
      }
    : player.notice;
  // Power failure sets speed to -1/zoom before the same frame's key handling.
  let speedPerFrame = powerFailed ? -1 / zoom : player.speedPerFrame;

  if (controls.accelerate && -speedPerFrame < vessel.maximumSpeedPerFrame && energy > 0 && canControlVessel) {
    speedPerFrame -= 2;
    if (canWarp && speedPerFrame < warpThreshold) speedPerFrame -= 5 / zoom;
    if (speedPerFrame < absoluteSpeedLimit) speedPerFrame = absoluteSpeedLimit;
  }

  if (controls.decelerate && canControlVessel) {
    speedPerFrame += 1 / zoom;
    if (canWarp && speedPerFrame < warpThreshold) speedPerFrame += 5 / zoom;
    if (speedPerFrame > 0) speedPerFrame = 0;
  }

  const originalRotation = player.rotationDegrees;
  const flightMode = flightModeAt(speedPerFrame, vessel.maximumSpeedPerFrame, zoom);
  const turn = flightMode === 'warp' ? vessel.turnDegreesPerFrame / 2 : vessel.turnDegreesPerFrame;
  let rotationDegrees = originalRotation;
  if (controls.turnLeft && canControlVessel) rotationDegrees = originalRotation - turn;
  // Flash processed right after left using the same captured rotation. Right
  // therefore wins if both keys are held; this separate branch preserves that.
  if (controls.turnRight && canControlVessel) rotationDegrees = originalRotation + turn;

  const rotationRadians = rotationDegrees * DEGREES_TO_RADIANS;
  const flashWorldOffsetX = Math.sin(rotationRadians) * speedPerFrame;
  const flashWorldOffsetY = Math.cos(rotationRadians) * speedPerFrame * -1;

  return freezePlayerMovementState({
    ...player,
    energy,
    notice,
    speedPerFrame,
    flightMode,
    rotationDegrees: normalizeDegrees(rotationDegrees),
    position: {
      x: player.position.x - flashWorldOffsetX,
      y: player.position.y - flashWorldOffsetY,
    },
  });
}

function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** Four-draw `createship()` distribution and initial planet-seeking intent. */
export function createStartingNpc(context: StartingNpcContext): StartingNpcPlacement {
  if (context.encounterId !== 'earth-runabout') throw new Error(`Unknown BM1 encounter ${context.encounterId}.`);
  const planet = context.targetCandidates.find(candidate => candidate.kind === 'planet');
  if (!planet) throw new Error('The Earth Runabout encounter requires a planet target.');
  let randomState = context.seed;
  const draw = (): number => {
    const result = nextRandomInteger(randomState, ENCOUNTER_RANDOM_EXTENT);
    randomState = result.state;
    return result.value;
  };
  return Object.freeze({
    position: Object.freeze({
      x: context.playerPosition.x - PLAYER_STAGE_ANCHOR.x + draw() - draw(),
      y: context.playerPosition.y - PLAYER_STAGE_ANCHOR.y + draw() - draw(),
    }),
    targetEntityId: planet.id,
    targetOffset: Object.freeze({ x: 0, y: 0 }),
    randomState,
  });
}

/** Peaceful steering (Symbol-12-6218.as:69–106) and combat steering
 * (Symbol-12-11050.as:228–273). Offset draws now belong exclusively to the
 * decision lead. A changed alert selects next movement policy in the engine's
 * accepted decisions-then-movement order (not a native timeline claim). */
export function updateNpcMovement(
  npc: NpcMovementState,
  vessel: NpcNavigationCapabilities,
  target: NpcTargetState,
  zoom: number,
  randomState: number,
  alert: NpcCombatState['alert'] = 'peaceful',
  combat?: NpcCombatState
) {
  const fighting = alert === 'combat';
  if (fighting && !hasNpcFlightStrength(vessel.strengthPercent ?? 100))
    return { randomState, movement: freezeNpcMovementState({ ...npc, rotationDegrees: npc.rotationDegrees + 1 }) };
  const targetOffset = npc.targetOffset;
  const position = npc.position;
  const targetX = target.position.x + targetOffset.x;
  const targetY = target.position.y + targetOffset.y;
  const wantedRotation = Math.round((Math.atan2(targetY - position.y, targetX - position.x) * 180) / Math.PI);
  let angleDelta = Math.abs(wantedRotation - npc.rotationDegrees) + 90;
  if (angleDelta > 360) angleDelta -= 360;
  let rotationDegrees = npc.rotationDegrees;
  if (angleDelta > 180 && Math.abs(angleDelta - 180) > 10 && angleDelta > 10 && angleDelta < 350) {
    rotationDegrees -= vessel.turnDegreesPerFrame;
  }
  if (angleDelta < 180 && Math.abs(angleDelta - 180) > 10 && angleDelta > 10 && angleDelta < 350) {
    rotationDegrees += vessel.turnDegreesPerFrame;
  }
  let desiredSpeed = npc.motion.desiredSpeedPerFrame;
  if (angleDelta > 120 && angleDelta < 200) desiredSpeed = 5 / zoom;
  // Combat tests use un-offset target coordinates (:247–260). The reviewed
  // phase order supplies final intent; see the C10b handoff for snapshot timing.
  // Peaceful arithmetic is retained exactly from the existing port.
  const sourceDelta = worldOffsetToSourceStage(
    { x: target.position.x - position.x, y: target.position.y - position.y },
    zoom
  );
  const distanceX = fighting ? Math.abs(sourceDelta.x) : Math.abs(position.x - targetX);
  const distanceY = fighting ? Math.abs(sourceDelta.y) : Math.abs(position.y - targetY);
  if (!fighting) {
    if (distanceX < 1000 / zoom && distanceY < 1000 / zoom) desiredSpeed = distanceX / 40;
    if (distanceX > 500 / zoom && distanceY > 500 / zoom) desiredSpeed = vessel.maximumSpeedPerFrame / zoom;
  }
  if (fighting) {
    if (distanceX > 3000 / zoom && distanceY > 3000 / zoom) {
      const first = nextRandomInteger(randomState, 10);
      const second = nextRandomInteger(first.state, 10);
      randomState = second.state;
      rotationDegrees = wantedRotation + 90 + first.value - second.value;
    }
    if (distanceX < 400 / zoom && distanceY < 400 / zoom) desiredSpeed = distanceX / 25;
    if (distanceX > 400 / zoom && distanceY > 400 / zoom) desiredSpeed = vessel.maximumSpeedPerFrame / zoom;
    if (distanceX < 200 / zoom && distanceY < 200 / zoom) desiredSpeed = 1 / zoom;
    if (combat?.strafing && desiredSpeed < 20 / zoom) desiredSpeed = 20 / zoom;
  }
  let speed = npc.motion.speedPerFrame;
  if (speed < 0 || desiredSpeed < 0) {
    speed = 0;
    desiredSpeed = 0;
  }
  if (speed < desiredSpeed) speed += (fighting ? 5 : 3) / zoom;
  if (speed > desiredSpeed) speed -= (fighting ? 2 : 3) / zoom;
  // Source's two sequential adjustments can overshoot below zero when a
  // released tractor target approaches a nearby destination. Negative NPC
  // speed violates the authoritative motion contract; clamp only that result,
  // retaining the authored acceleration/deceleration order and desired speed.
  speed = Math.max(0, speed);
  const radians = (rotationDegrees * Math.PI) / 180;
  // Combat's stage displacement is inverted through the shared camera helper.
  // Peaceful world displacement remains the delivered pre-C10b behaviour.
  const combatStage = worldToSourceStage(position, position, zoom);
  const movedPosition = fighting
    ? sourceStageToWorld(
        {
          x: combatStage.x + (Math.sin(radians) * speed) / zoom,
          y: combatStage.y - (Math.cos(radians) * speed) / zoom,
        },
        position,
        zoom
      )
    : {
        x: position.x + (Math.sin(radians) * speed) / zoom,
        y: position.y - (Math.cos(radians) * speed) / zoom,
      };
  return {
    randomState,
    movement: freezeNpcMovementState({
      rotationDegrees,
      position: movedPosition,
      motion: Object.freeze({ speedPerFrame: speed, desiredSpeedPerFrame: desiredSpeed }),
      targetOffset,
    }),
  };
}

/** Trusted compatibility implementation; only the BM1 build imports this. */
export const rules: GameRules = Object.freeze({
  apiVersion: 29,
  decideNpcCombat,
  respondToPlayerShot,
  missions,
  fleet,
  createVisitEncounter,
  resolveProgression,
  createCargoMarket,
  planCargoTransfer,
  quoteResourceSale,
  quoteResourcePurchase,
  evaluateEquipmentPrice,
  createEquipmentMarket,
  validateEquipmentMarket,
  getProjectileFlight,
  advanceProjectileMotion,
  getSpecialWeapon,
  selectSpecialEffectSlots,
  evaluateVesselPurchase,
  moduleId: 'bm1',
  updatePlayerMovement,
  createStartingNpc,
  updateNpcMovement,
  evaluatePrimaryFire,
  resolvePrimaryHit,
  resolveStationHit,
  resolveLifecycleHit,
  resolveStationMembership,
  validateStationMembership,
  validateGeneratedActor,
  evaluateRepairStart,
  updateRepair,
  rechargePlayerShields,
  estimateTravel,
  canDepart,
  createTravelArrival,
});
