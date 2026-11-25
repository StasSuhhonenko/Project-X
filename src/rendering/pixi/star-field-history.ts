/** Fixed-tick backdrop state, isolated from gameplay and from Pixi/browser APIs. */
import { z } from 'zod';
import type { StarDefinition, StarFieldDefinition } from '../../content/schemas/star-field';
import { nextRandomUnit } from '../../random/seeded-random';
import { selectPlayerEntity, type WorldState } from '../../simulation/model/world-state';
import { interpolateRotation } from '../shared/transform-history';

const StarStateSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    rotationDegrees: z.number().finite(),
    scaleY: z.number().finite().positive(),
    respawned: z.boolean(),
  })
  .readonly();
export type StarState = z.infer<typeof StarStateSchema>;

/** A presentation frame derived once from the two completed player snapshots. */
export interface StarMotion {
  readonly x: number;
  readonly y: number;
  readonly speedPerFrame: number;
  readonly rotationDegrees: number;
  readonly zoom?: number;
  readonly flightMode?: 'impulse' | 'warp';
}
interface Bounds {
  readonly width: number;
  readonly height: number;
}

/**
 * Complete state of one field, frozen, so a replacement view of the same scene
 * can continue it. A purchase that remounts the renderer (new hull or new
 * fleet artwork) keeps the system; restarting the field there snapped the
 * stars and the scroll-driven parallax layers back to their entry placement.
 * Opaque to callers: only `createStarFieldHistory` reads it.
 */
export interface StarFieldContinuity {
  readonly world: WorldState;
  readonly starCount: number;
  readonly seed: number;
  readonly current: readonly StarState[];
  readonly previous: readonly StarState[];
  readonly scroll: Readonly<{ x: number; y: number }>;
  readonly previousScroll: Readonly<{ x: number; y: number }>;
  readonly motion: StarMotion;
}

/** Same player in the same system, at or before the new view's world. A new
 * game or an earlier save starts fresh; a later tick is then decided by the
 * ordinary advance rules (one tick continues, a gap restarts). */
const continues = (carried: StarFieldContinuity, definition: StarFieldDefinition, world: WorldState): boolean =>
  carried.starCount === definition.stars.length &&
  carried.world.playerEntityId === world.playerEntityId &&
  carried.world.tick <= world.tick &&
  selectPlayerEntity(carried.world).location.systemId === selectPlayerEntity(world).location.systemId;

/**
 * The per-tick orientation rule shared by motion and (re)initialization:
 * while the player moves, a particle takes the player's rotation and, when it
 * declares stretch, the warp scale for the current speed and zoom. A stationary
 * player leaves orientation unchanged. Returns only the oriented fields.
 */
function orientStar(
  prior: Pick<StarState, 'rotationDegrees' | 'scaleY'>,
  definition: StarDefinition,
  motion: Pick<StarMotion, 'speedPerFrame' | 'rotationDegrees' | 'zoom' | 'flightMode'>
): Pick<StarState, 'rotationDegrees' | 'scaleY'> {
  if (motion.speedPerFrame === 0) return prior;
  const scaleY = !definition.stretch
    ? prior.scaleY
    : motion.flightMode === 'warp' && motion.speedPerFrame < definition.stretch.speedThreshold / (motion.zoom ?? 1)
      ? definition.stretch.scaleY
      : 1;
  return { rotationDegrees: motion.rotationDegrees, scaleY };
}

/**
 * Advance a particle once. Ordered edge checks discard overshoot for random
 * respawns, including corners; toroidal wrapping retains both coordinates.
 * Random draws occur only on respawn and must be in [0,1).
 */
export function advanceStar(
  prior: StarState,
  definition: StarDefinition,
  motion: StarMotion,
  bounds: Bounds,
  boundary: StarFieldDefinition['boundary'],
  random: () => number
): StarState {
  let { x, y, rotationDegrees, scaleY } = prior;
  if (motion.speedPerFrame !== 0) {
    x += motion.x * definition.parallax;
    y += motion.y * definition.parallax;
    ({ rotationDegrees, scaleY } = orientStar(prior, definition, motion));
  }
  let respawned = false;
  const randomInteger = (limit: number): number => {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1)
      throw new Error('Backdrop random source must return [0, 1).');
    respawned = true;
    return Math.floor(value * limit);
  };
  if (boundary === 'random-edge') {
    // Each check observes the preceding check's result. This matters at corners.
    if (x < 0) {
      x = bounds.width;
      y = randomInteger(bounds.height);
    }
    if (x > bounds.width) {
      x = 0;
      y = randomInteger(bounds.height);
    }
    if (y < 0) {
      x = randomInteger(bounds.width);
      y = bounds.height;
    }
    if (y > bounds.height) {
      x = randomInteger(bounds.width);
      y = 0;
    }
  }
  if (boundary === 'wrap') {
    respawned = x < 0 || x > bounds.width || y < 0 || y > bounds.height;
    if (x < 0 || x > bounds.width) x = ((x % bounds.width) + bounds.width) % bounds.width;
    if (y < 0 || y > bounds.height) y = ((y % bounds.height) + bounds.height) % bounds.height;
  }
  return Object.freeze({ x, y, rotationDegrees, scaleY, respawned });
}

/**
 * Keeps two visual snapshots and a private deterministic random stream. Random
 * consumption depends on committed ticks, never display rate or gameplay RNG.
 * Pause collapses interpolation without moving stars or reseeding; replacement,
 * travel, or missed ticks restart the field rather than inventing missing steps.
 */
export function createStarFieldHistory(
  definition: StarFieldDefinition,
  bounds: Bounds,
  initialWorld: WorldState,
  carried: StarFieldContinuity | null = null
) {
  /**
   * Fresh particles for `forWorld`, already oriented to its player. Without
   * this, a field restarted while moving (jump arrival at warp) first painted
   * the authored rotation 0 and then interpolated a visible sweep to the
   * heading during the first tick. The source assigns `_rotation` from the
   * player outright each moving frame, never interpolating, so orienting the
   * restart state applies that same rule one tick earlier. Positions and the
   * random stream still restart exactly as before.
   */
  const initialize = (forWorld: WorldState): readonly StarState[] => {
    const player = selectPlayerEntity(forWorld);
    const motionNow = {
      speedPerFrame: player.motion.speedPerFrame,
      rotationDegrees: player.location.rotationDegrees,
      flightMode: player.motion.flightMode,
      zoom: forWorld.cameraZoom,
    };
    return Object.freeze(
      definition.stars.map((star, index) =>
        Object.freeze({
          ...star.position,
          ...orientStar({ rotationDegrees: 0, scaleY: star.initialScale }, definition.stars[index]!, motionNow),
          respawned: false,
        })
      )
    );
  };
  const adopted = carried && continues(carried, definition, initialWorld) ? carried : null;
  let current = adopted ? adopted.current : initialize(initialWorld);
  let previous = adopted ? adopted.previous : current;
  let world = adopted ? adopted.world : initialWorld;
  let seed = adopted ? adopted.seed : definition.seed;
  let scroll = adopted ? adopted.scroll : { x: 0, y: 0 };
  let previousScroll = adopted ? adopted.previousScroll : scroll;
  let motion: StarMotion = adopted ? adopted.motion : { x: 0, y: 0, speedPerFrame: 0, rotationDegrees: 0 };
  const random = (): number => {
    const step = nextRandomUnit(seed);
    seed = step.state;
    return step.value;
  };
  const interpolate = (from: readonly StarState[], to: readonly StarState[], alpha: number) => {
    const fraction = Math.max(0, Math.min(1, alpha));
    return Object.freeze(
      to.map((star, index) => {
        if (star.respawned) return star;
        const prior = from[index]!;
        return Object.freeze({
          ...star,
          x: prior.x + (star.x - prior.x) * fraction,
          y: prior.y + (star.y - prior.y) * fraction,
          rotationDegrees: interpolateRotation(prior.rotationDegrees, star.rotationDegrees, fraction),
        });
      })
    );
  };
  const offset = (alpha: number) => {
    const fraction = Math.max(0, Math.min(1, alpha));
    return Object.freeze({
      x: previousScroll.x + (scroll.x - previousScroll.x) * fraction,
      y: previousScroll.y + (scroll.y - previousScroll.y) * fraction,
    });
  };
  const reset = (nextWorld: WorldState): void => {
    if (nextWorld !== world) {
      current = initialize(nextWorld);
      seed = definition.seed;
      scroll = { x: 0, y: 0 };
      motion = { x: 0, y: 0, speedPerFrame: 0, rotationDegrees: 0 };
    }
    previous = current;
    previousScroll = scroll;
    world = nextWorld;
  };
  const advance = (nextWorld: WorldState): void => {
    if (nextWorld === world) return;
    const priorPlayer = selectPlayerEntity(world);
    const player = selectPlayerEntity(nextWorld);
    // A same-tick publication in the same scene is a command result (a
    // purchase, repair or selection that rewrites entities), not motion: no
    // tick ran, so stars and scroll stay put. Treating it as a missed tick
    // restarted the field and zeroed the scroll that positions parallax
    // layers, snapping the system star and its layer back to their entry
    // placement after every planet purchase.
    if (
      nextWorld.tick === world.tick &&
      nextWorld.playerEntityId === world.playerEntityId &&
      player.location.systemId === priorPlayer.location.systemId
    ) {
      world = nextWorld;
      return;
    }
    if (
      nextWorld.tick !== world.tick + 1 ||
      nextWorld.playerEntityId !== world.playerEntityId ||
      player.location.systemId !== priorPlayer.location.systemId
    ) {
      reset(nextWorld);
      return;
    }
    motion = {
      x: (priorPlayer.location.position.x - player.location.position.x) / nextWorld.cameraZoom,
      y: (priorPlayer.location.position.y - player.location.position.y) / nextWorld.cameraZoom,
      speedPerFrame: player.motion.speedPerFrame,
      flightMode: player.motion.flightMode,
      rotationDegrees: player.location.rotationDegrees,
      zoom: nextWorld.cameraZoom,
    };
    previous = current;
    previousScroll = scroll;
    scroll = { x: scroll.x + motion.x, y: scroll.y + motion.y };
    current = Object.freeze(
      current.map((star, index) =>
        advanceStar(star, definition.stars[index]!, motion, bounds, definition.boundary, random)
      )
    );
    world = nextWorld;
  };
  // An adopted field may be a tick or more behind the new view's world; the
  // ordinary rules continue it (same tick, one tick) or restart it (gap).
  if (adopted) advance(initialWorld);
  return {
    reset,
    sampleOffset: offset,
    advance,
    sample(alpha: number): readonly StarState[] {
      return interpolate(previous, current, alpha);
    },
    /** Frozen state for a replacement view of the same scene. */
    snapshot(): StarFieldContinuity {
      return Object.freeze({
        world,
        starCount: definition.stars.length,
        seed,
        current,
        previous,
        scroll: Object.freeze({ ...scroll }),
        previousScroll: Object.freeze({ ...previousScroll }),
        motion: Object.freeze({ ...motion }),
      });
    },
  };
}

/**
 * One relay per presentation instance. A replacement view is created while the
 * retiring one may still be attached, so `take` reads the registered live view
 * first and otherwise the snapshot kept when the last view released. Only the
 * most recent registration is live; a stale release is ignored.
 */
export function createStarFieldHandoff() {
  let live: (() => StarFieldContinuity) | null = null;
  let last: StarFieldContinuity | null = null;
  return Object.freeze({
    take: (): StarFieldContinuity | null => (live ? live() : last),
    register(read: () => StarFieldContinuity): () => void {
      live = read;
      return () => {
        if (live !== read) return;
        last = read();
        live = null;
      };
    },
  });
}
