/**
 * View-owned hull-damage mask: a renderer-neutral policy schema plus pure
 * helpers that choose each actor's mask frame and the frame's placement.
 *
 * A damage mask is a stepped clipping shape over an actor's artwork. As the
 * actor's durability share falls, a later frame with more of the outline cut
 * away is selected, so parts of the ship disappear. The mask clips only the
 * actor's own artwork (never overlays such as the shield flash).
 *
 * Units and spaces:
 * - Contour points are in *mask-local* pixels around the mask's own origin.
 * - The mask origin is given in *host* pixels: the actor's unrotated
 *   artwork space at zoom one, whose origin is the artwork's pivot point
 *   (the same space as `entityVisualSize`).
 * - Placement scales the mask so that its reference bounds equal the artwork
 *   size plus a padding, independently per axis, and keeps the origin fixed
 *   (a legacy `_width`/`_height` assignment scales about the registration point).
 *
 * Saves never contain mask state: the frame is derived from committed
 * durability every time, so load and scene rebinding need no reset.
 */
import { z } from 'zod';
import type { DurabilityComponent } from '../../simulation/model/entity-components';
import { combinedDurabilityPercent } from '../../simulation/model/npc-state';
import type { WorldState } from '../../simulation/model/world-state';

const FiniteNumber = z.number().finite();
const Point = z.tuple([FiniteNumber, FiniteNumber]).readonly();

/** One closed contour: a start point and straight or quadratic segments back to it. */
const DamageMaskContourSchema = z
  .object({
    start: Point,
    segments: z
      .array(z.object({ to: Point, control: Point.optional() }).strict().readonly())
      .min(2)
      .max(2000)
      .readonly(),
  })
  .strict()
  .readonly();

/** A filled outline with the holes cut from it. Renderers fill, then cut. */
const DamageMaskRegionSchema = z
  .object({ outline: DamageMaskContourSchema, holes: z.array(DamageMaskContourSchema).max(64).readonly() })
  .strict()
  .readonly();

const BoundsSchema = z
  .object({ left: FiniteNumber, top: FiniteNumber, right: FiniteNumber, bottom: FiniteNumber })
  .strict()
  .refine(bounds => bounds.right > bounds.left && bounds.bottom > bounds.top, 'Mask bounds must be non-empty.')
  .readonly();

const DamageMaskFrameSchema = z
  .object({
    /** Reference envelope of this frame's fill, used for size-based placement. */
    bounds: BoundsSchema,
    regions: z.array(DamageMaskRegionSchema).min(1).max(64).readonly(),
  })
  .strict()
  .readonly();

const DamageMaskSetSchema = z
  .object({
    /** Frame 1 is the healthiest; later frames show more damage. */
    frames: z.array(DamageMaskFrameSchema).min(1).max(32).readonly(),
    /** Mask origin in host pixels (artwork pivot space). */
    origin: z.object({ x: FiniteNumber, y: FiniteNumber }).strict().readonly(),
    /** Added to the artwork width and height before scaling the mask to them. */
    paddingPixels: z.number().finite().min(0).max(1000),
    /**
     * Which frame's bounds define the scale: `current` re-fits on every frame
     * change; `first` fits once to frame 1 and keeps that scale.
     */
    boundsFrame: z.enum(['current', 'first']),
  })
  .strict()
  .readonly();

export const DamageMaskAppearanceSchema = z
  .object({
    /** Percent of durability covered by each frame step (100 / step frames cover 0-100 %). */
    percentPerFrame: z.number().finite().positive().max(100),
    /** Omitted: the player is never masked. Measures hull only. */
    player: DamageMaskSetSchema.optional(),
    /** Omitted: world actors are never masked. Ships measure hull plus shields; stations their strength. */
    actors: DamageMaskSetSchema.optional(),
  })
  .strict()
  .readonly();
export type DamageMaskAppearance = z.infer<typeof DamageMaskAppearanceSchema>;
export type DamageMaskSet = z.infer<typeof DamageMaskSetSchema>;
export type DamageMaskFrame = z.infer<typeof DamageMaskFrameSchema>;
export type DamageMaskContour = z.infer<typeof DamageMaskContourSchema>;

/**
 * One-based frame for a durability share in percent. Legacy rule:
 * `floor(frames + 1 - percent / percentPerFrame)`, clamped to the frame range
 * (a destroyed actor stays on the last frame; overfull values on the first).
 * With five 20 % frames: above 80 % -> 1, above 60 % -> 2, ... above 0 % -> 5.
 */
export function damageMaskFrameNumber(percent: number, frameCount: number, percentPerFrame: number): number {
  if (!Number.isFinite(percent)) return 1;
  const frame = Math.floor(frameCount + 1 - percent / percentPerFrame);
  return Math.min(frameCount, Math.max(1, frame));
}

/**
 * Host-space affine placement for a selected frame: `host = origin + scale * local`.
 * Artwork size is the unrotated artwork width and height at zoom one.
 */
export function damageMaskPlacement(
  set: DamageMaskSet,
  frameNumber: number,
  artwork: Readonly<{ width: number; height: number }>
): Readonly<{ originX: number; originY: number; scaleX: number; scaleY: number }> {
  const reference = set.frames[set.boundsFrame === 'first' ? 0 : frameNumber - 1]!.bounds;
  return Object.freeze({
    originX: set.origin.x,
    originY: set.origin.y,
    scaleX: (Math.abs(artwork.width) + set.paddingPixels) / (reference.right - reference.left),
    scaleY: (Math.abs(artwork.height) + set.paddingPixels) / (reference.bottom - reference.top),
  });
}

type Entity = WorldState['entities'][number];

/**
 * Durability share in percent for a maskable entity, or null when the entity
 * kind is never masked or its maximum is unknown. The player measures hull
 * against its maximum hull; NPC ships measure hull plus shields; stations use
 * their scalar combat strength, and a station without combat state is intact.
 */
export function damageMaskPercent(
  entity: Entity,
  maximumOf: (definitionId: number) => DurabilityComponent | undefined
): number | null {
  if (entity.kind === 'station') {
    if (!entity.combat) return 100;
    return (entity.combat.strength / entity.combat.maximumStrength) * 100;
  }
  if (entity.kind !== 'player-ship' && entity.kind !== 'npc-ship') return null;
  const maximum = maximumOf(entity.definitionId);
  if (!maximum) return null;
  if (entity.kind === 'npc-ship') return combinedDurabilityPercent(entity.condition, maximum);
  if (maximum.hull <= 0) return null;
  return (entity.condition.hull / maximum.hull) * 100;
}
