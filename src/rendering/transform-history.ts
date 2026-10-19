/** Read-only presentation history derived from completed simulation worlds. */
import type { WorldState } from '../simulation/model/world-state';

/** Immutable transform sample consumed only by presentation adapters. */
export interface PresentationTransform {
  readonly x: number;
  readonly y: number;
  readonly rotationDegrees: number;
}

function transforms(world: WorldState): ReadonlyMap<string, PresentationTransform> {
  return new Map(world.entities.map(entity => [entity.id, {
    x: entity.location.position.x,
    y: entity.location.position.y,
    rotationDegrees: entity.location.rotationDegrees,
  }]));
}

/** Interpolate clockwise degrees over the shortest wrapped arc. */
export function interpolateRotation(previous: number, current: number, alpha: number): number {
  const shortestArc = ((current - previous + 540) % 360 + 360) % 360 - 180;
  return previous + shortestArc * alpha;
}

export interface TransformHistory {
  advance(world: WorldState): void;
  reset(world: WorldState): void;
  sample(entityId: string, alpha: number): PresentationTransform | null;
}

/**
 * Keeps only two completed transform snapshots. Restart, travel, restore and
 * same-tick world replacement rebase history; selection-only world updates
 * retain both transform snapshots. Removed IDs disappear at once.
 * Samples never mutate or enter the simulation world.
 */
export function createTransformHistory(initialWorld: WorldState): TransformHistory {
  let previous = transforms(initialWorld);
  let current = previous;
  let currentWorld = initialWorld;

  const reset = (world: WorldState): void => {
    previous = transforms(world);
    current = previous;
    currentWorld = world;
  };

  return {
    reset,
    advance: world => {
      if (world.tick === currentWorld.tick && world.entities === currentWorld.entities) {
        currentWorld = world;
        return;
      }
      const player = world.entities.find(entity => entity.id === world.playerEntityId);
      const priorPlayer = currentWorld.entities.find(entity => entity.id === currentWorld.playerEntityId);
      if (world.tick <= currentWorld.tick || world.playerEntityId !== currentWorld.playerEntityId
          || player?.location.systemId !== priorPlayer?.location.systemId) {
        reset(world);
        return;
      }
      previous = current;
      current = transforms(world);
      currentWorld = world;
    },
    sample: (entityId, alpha) => {
      const next = current.get(entityId);
      if (!next) return null;
      const prior = previous.get(entityId) ?? next;
      const fraction = Math.min(1, Math.max(0, alpha));
      return {
        x: prior.x + (next.x - prior.x) * fraction,
        y: prior.y + (next.y - prior.y) * fraction,
        rotationDegrees: interpolateRotation(prior.rotationDegrees, next.rotationDegrees, fraction),
      };
    },
  };
}
