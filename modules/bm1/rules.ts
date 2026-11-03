/**
 * Evidence-based fixed-frame navigation for the player vessel.
 *
 * Provenance: `analysis/bm1/scripts/Symbol-2-6202.as`, navigation and
 * `locx`/`locy` sections. The Flash game held the ship at screen center and
 * translated the world. The port stores the inverse translation as a world
 * position, which gives the same camera-relative motion.
 */
import type { PlayerControls } from '../../src/simulation/commands/player-controls';
import { resolveStationHit, resolveLifecycleHit, validateGeneratedActor, resolveStationMembership, validateStationMembership } from './station-lifecycle';
import { freezePlayerMovementState, type PlayerMovementState } from '../../src/simulation/model/player-state';
import type {
  GameRules,
  NpcNavigationCapabilities,
  PlayerVesselCapabilities,
  StartingNpcContext,
} from '../../src/simulation/contracts/game-rules';
import {
  freezeNpcMovementState,
  type NpcMovementState,
  type NpcTargetState,
  type StartingNpcPlacement,
} from '../../src/simulation/model/npc-state';
import { nextRandomInteger } from '../../src/random/seeded-random';
import { evaluatePrimaryFire } from './primary-weapon';
import { resolvePrimaryHit } from './primary-hit';
import { evaluateRepairStart, updateRepair } from './repair';
import { canDepart, estimateTravel } from './travel';
import { energyCapacity } from './energy-capacity';
import { PLAYER_STAGE_ANCHOR } from './source-geometry';

const WARP_THRESHOLD_PER_FRAME = -25;
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
  zoom = 1,
): PlayerMovementState {

  const warpThreshold = WARP_THRESHOLD_PER_FRAME / zoom;
  // A ship whose authored maximum never exceeds native warp speed remains an
  // impulse craft at every camera scale. The source's zoom arithmetic by
  // itself would otherwise label a zoomed-out Saber as warping.
  const canWarp = vessel.maximumSpeedPerFrame > -WARP_THRESHOLD_PER_FRAME;
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
    energy += vessel.startingWeaponIds.includes(WARP_CORE_DEVICE_ID)
      ? reserveRecharge * 2 : reserveRecharge;
  }
  const powerFailed = energy < 0;
  if (powerFailed) energy = 0;
  // Flash writes this information-panel text and leaves it until another
  // message replaces it. Sequence lets a future audio adapter react once.
  const notice = powerFailed ? {
    sequence: (player.notice?.sequence ?? 0) + 1,
    code: 'power-failure',
    message: 'Warning: Power Failure.',
  } : player.notice;
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
  const flightMode = canWarp && speedPerFrame < warpThreshold ? 'warp' : 'impulse';
  const turn = flightMode === 'warp'
    ? vessel.turnDegreesPerFrame / 2
    : vessel.turnDegreesPerFrame;
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

/** Planet-seeking movement from `Symbol-12-6218.as` (pre-combat path only). */
export function updateNpcMovement(npc: NpcMovementState, vessel: NpcNavigationCapabilities,
  target: NpcTargetState, zoom: number, randomState: number) {
  let stream = nextRandomInteger(randomState, 50);
  randomState = stream.state;
  let targetOffset = npc.targetOffset;
  if (stream.value === 1) {
    const draw = () => {
      stream = nextRandomInteger(randomState, 500);
      randomState = stream.state;
      return stream.value;
    };
    targetOffset = { x: (draw() - draw()) / zoom, y: (draw() - draw()) / zoom };
  }
  const position = npc.position;
  const targetX = target.position.x + targetOffset.x;
  const targetY = target.position.y + targetOffset.y;
  const wantedRotation = Math.round(Math.atan2(targetY - position.y, targetX - position.x) * 180 / Math.PI);
  let angleDelta = Math.abs(wantedRotation - npc.rotationDegrees) + 90;
  if (angleDelta > 360) angleDelta -= 360;
  let rotationDegrees = npc.rotationDegrees;
  if (angleDelta > 180 && Math.abs(angleDelta - 180) > 10 && angleDelta > 10 && angleDelta < 350) {
    rotationDegrees -= vessel.turnDegreesPerFrame;
  } else if (angleDelta < 180 && Math.abs(angleDelta - 180) > 10 && angleDelta > 10 && angleDelta < 350) {
    rotationDegrees += vessel.turnDegreesPerFrame;
  }
  let desiredSpeed = npc.motion.desiredSpeedPerFrame;
  if (angleDelta > 120 && angleDelta < 200) desiredSpeed = 5 / zoom;
  const distanceX = Math.abs(position.x - targetX);
  const distanceY = Math.abs(position.y - targetY);
  if (distanceX < 1000 / zoom && distanceY < 1000 / zoom) desiredSpeed = distanceX / 40;
  if (distanceX > 500 / zoom && distanceY > 500 / zoom) desiredSpeed = vessel.maximumSpeedPerFrame / zoom;
  let speed = npc.motion.speedPerFrame;
  if (speed < 0 || desiredSpeed < 0) {
    speed = 0;
    desiredSpeed = 0;
  }
  if (speed < desiredSpeed) speed += 3 / zoom;
  if (speed > desiredSpeed) speed -= 3 / zoom;
  const radians = rotationDegrees * Math.PI / 180;
  return {
    randomState,
    movement: freezeNpcMovementState({
      rotationDegrees,
      position: {
        x: position.x + Math.sin(radians) * speed / zoom,
        y: position.y - Math.cos(radians) * speed / zoom,
      },
      motion: Object.freeze({ speedPerFrame: speed, desiredSpeedPerFrame: desiredSpeed }),
      targetOffset,
    }),
  };
}

/** Trusted compatibility implementation; only the BM1 build imports this. */
export const rules: GameRules = Object.freeze({
  apiVersion: 14,
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
  estimateTravel,
  canDepart,
});
