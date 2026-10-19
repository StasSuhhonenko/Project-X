/** Fixed-tick backdrop state, isolated from gameplay and from Pixi/browser APIs. */
import { z } from 'zod';
import type { StarDefinition, StarFieldDefinition } from '../content/schemas/star-field';
import { nextRandomUnit } from '../random/seeded-random';
import { selectPlayerEntity, type WorldState } from '../simulation/model/world-state';
import { interpolateRotation } from './transform-history';

const StarStateSchema = z.object({
  x: z.number().finite(), y: z.number().finite(),
  rotationDegrees: z.number().finite(), scaleY: z.number().finite().positive(),
  respawned: z.boolean(),
}).readonly();
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
interface Bounds { readonly width: number; readonly height: number }

/**
 * Advance a particle once. Ordered edge checks discard overshoot for random
 * respawns, including corners; toroidal wrapping retains both coordinates.
 * Random draws occur only on respawn and must be in [0,1).
 */
export function advanceStar(
  prior: StarState, definition: StarDefinition, motion: StarMotion, bounds: Bounds,
  boundary: StarFieldDefinition['boundary'], random: () => number,
): StarState {
  let { x, y, rotationDegrees, scaleY } = prior;
  if (motion.speedPerFrame !== 0) {
    x += motion.x * definition.parallax;
    y += motion.y * definition.parallax;
    rotationDegrees = motion.rotationDegrees;
    if (definition.stretch) {
      scaleY = motion.flightMode === 'warp'
        && motion.speedPerFrame < definition.stretch.speedThreshold / (motion.zoom ?? 1)
        ? definition.stretch.scaleY : 1;
    }
  }
  let respawned = false;
  const randomInteger = (limit: number): number => {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Backdrop random source must return [0, 1).');
    respawned = true;
    return Math.floor(value * limit);
  };
  if (boundary === 'random-edge') {
    // Each check observes the preceding check's result. This matters at corners.
    if (x < 0) { x = bounds.width; y = randomInteger(bounds.height); }
    if (x > bounds.width) { x = 0; y = randomInteger(bounds.height); }
    if (y < 0) { x = randomInteger(bounds.width); y = bounds.height; }
    if (y > bounds.height) { x = randomInteger(bounds.width); y = 0; }
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
export function createStarFieldHistory(definition: StarFieldDefinition, bounds: Bounds, initialWorld: WorldState) {
  const initialize = (): readonly StarState[] => Object.freeze(definition.stars.map(star => Object.freeze({
    ...star.position, rotationDegrees: 0, scaleY: star.initialScale, respawned: false,
  })));
  let current = initialize();
  let previous = current;
  let world = initialWorld;
  let seed = definition.seed;
  const random = (): number => {
    const step = nextRandomUnit(seed);
    seed = step.state;
    return step.value;
  };
  const reset = (nextWorld: WorldState): void => {
    if (nextWorld !== world) { current = initialize(); seed = definition.seed; }
    previous = current;
    world = nextWorld;
  };
  return {
    reset,
    advance(nextWorld: WorldState): void {
      if (nextWorld === world) return;
      if (nextWorld.tick === world.tick && nextWorld.entities === world.entities) {
        world = nextWorld;
        return;
      }
      const priorPlayer = selectPlayerEntity(world);
      const player = selectPlayerEntity(nextWorld);
      if (nextWorld.tick !== world.tick + 1 || nextWorld.playerEntityId !== world.playerEntityId
          || player.location.systemId !== priorPlayer.location.systemId) {
        reset(nextWorld);
        return;
      }
      const motion = {
        x: (priorPlayer.location.position.x - player.location.position.x) / nextWorld.cameraZoom,
        y: (priorPlayer.location.position.y - player.location.position.y) / nextWorld.cameraZoom,
        speedPerFrame: player.motion.speedPerFrame,
        flightMode: player.motion.flightMode,
        rotationDegrees: player.location.rotationDegrees,
        zoom: nextWorld.cameraZoom,
      };
      previous = current;
      current = Object.freeze(current.map((star, index) =>
        advanceStar(star, definition.stars[index]!, motion, bounds, definition.boundary, random)));
      world = nextWorld;
    },
    sample(alpha: number): readonly StarState[] {
      const fraction = Math.max(0, Math.min(1, alpha));
      return Object.freeze(current.map((star, index) => {
        if (star.respawned) return star;
        const prior = previous[index]!;
        return Object.freeze({ ...star,
          x: prior.x + (star.x - prior.x) * fraction,
          y: prior.y + (star.y - prior.y) * fraction,
          rotationDegrees: interpolateRotation(prior.rotationDegrees, star.rotationDegrees, fraction),
        });
      }));
    },
  };
}
