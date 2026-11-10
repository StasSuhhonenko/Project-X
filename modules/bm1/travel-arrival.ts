/**
 * BM1 re-entry after an inter-system jump.
 *
 * Provenance: `analysis/bm1/scripts/Page-1-93293.as` (arrival script, run when
 * the arrival report returns to game frame 1), and the heading code at the end
 * of `loadplayer()` (`Page-1-25841.as:102-110`), which frame 1 runs next:
 *
 *     _root.speed = _root.totspeed*-1;
 *     gotoAndPlay(1);
 *     x = random(3);
 *     if (x == 0) { planet at (-1500, -1500) }   // stage pixels
 *     if (x == 1) { planet at ( 1500, -1500) }
 *     if (x == 2) { planet at (-1500,  1500) }
 *     if (x == 3) { planet at ( 1500,  1500) }   // unreachable: random(3) is 0..2
 *     ...
 *     myRadians = Math.atan2(targety-myy, targetx-mxx);   // mxx is never assigned
 *     rotation = Math.round(myRadians*180/Math.PI)+90;
 *
 * So the ship arrives at full forward speed (warp for warp-capable ships),
 * about 2,300 stage pixels from the planet, pointing roughly at it. The jump's
 * own speed never matters: the script always sets the vessel maximum.
 *
 * `mxx` is an undefined variable. The reference build is published for Flash
 * Player 6, where an undefined value converts to 0 in arithmetic, so the
 * heading aims from the stage's left edge (x 0) rather than from the player
 * (x 298.6). That small, legacy aiming error is preserved: the ship's nose is a
 * few degrees off the planet, as in the original.
 *
 * The planet stays put in world space; the player is placed so the planet
 * appears at the drawn stage corner at the retained camera zoom.
 */
import { nextRandomInteger } from '@engine/random/seeded-random';
import type { TravelArrivalContext, TravelArrivalResult } from '@engine/simulation/contracts/travel-arrival-rules';
import { flightModeAt } from './flight-mode';
import { PLAYER_STAGE_ANCHOR, sourceStageToWorld } from './source-geometry';

/** Page-1-93293.as planet stage positions, indexed by the `random(3)` draw. */
export const ARRIVAL_PLANET_STAGE_POSITIONS = Object.freeze([
  Object.freeze({ x: -1500, y: -1500 }),
  Object.freeze({ x: 1500, y: -1500 }),
  Object.freeze({ x: -1500, y: 1500 }),
  // Authored but unreachable under random(3); retained as source evidence.
  Object.freeze({ x: 1500, y: 1500 }),
]);

/** The undefined `mxx` operand of loadplayer's heading, as Flash Player 6 reads it. */
const UNDEFINED_AS_NUMBER = 0;

/** Arrival placement and motion; consumes exactly one world draw. */
export function createTravelArrival(context: TravelArrivalContext): TravelArrivalResult {
  const draw = nextRandomInteger(context.randomState, 3);
  const corner = ARRIVAL_PLANET_STAGE_POSITIONS[draw.value]!;
  const zoom = context.cameraZoom;
  // Place the player so worldToSourceStage(planet, player, zoom) === corner.
  // sourceStageToWorld maps a stage point to world for a given player; the
  // planet must land on `corner`, so shift a zero-origin player by the gap.
  const origin = { x: 0, y: 0 };
  const cornerAtOrigin = sourceStageToWorld(corner, origin, zoom);
  const position = {
    x: context.planetPosition.x - cornerAtOrigin.x,
    y: context.planetPosition.y - cornerAtOrigin.y,
  };
  // loadplayer reads the planet's stage position, which is exactly `corner`.
  const radians = Math.atan2(corner.y - PLAYER_STAGE_ANCHOR.y, corner.x - UNDEFINED_AS_NUMBER);
  const rotationDegrees = Math.round((radians * 180) / Math.PI) + 90;
  const speedPerFrame = -context.maximumSpeedPerFrame;
  return Object.freeze({
    position: Object.freeze(position),
    rotationDegrees,
    speedPerFrame,
    flightMode: flightModeAt(speedPerFrame, context.maximumSpeedPerFrame, zoom),
    randomState: draw.state,
  });
}
