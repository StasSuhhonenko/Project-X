/**
 * View-owned shield-impact flash: a renderer-neutral policy schema plus a
 * tracker that decides, per completed simulation tick, which actors flash and
 * how opaque their flash overlay is.
 *
 * Responsibilities and boundaries:
 * - The trigger is derived only from committed durability. An actor whose
 *   `hull + shields` fell between two consecutive observed ticks was hit.
 *   That single game-neutral signal covers every damage path (beams,
 *   projectiles, specials, NPC-vs-NPC) without a second event channel.
 * - Saves never contain flash state. `reset` (load, scene rebinding) settles
 *   without replaying a flash, like the cloak fade in `actor-opacity.ts`.
 * - The alpha curve is stepped per simulation tick, not interpolated: a
 *   legacy timeline changes `_alpha` once per authored frame.
 *
 * Known limitation: a hit whose loss is fully offset by a gain in the same
 * tick (for example the player's paid repair) changes no durability and so
 * does not flash.
 */
import { z } from 'zod';
import type { DurabilityComponent } from '../../simulation/model/entity-components';
import { combinedDurabilityPercent } from '../../simulation/model/npc-state';
import type { WorldState } from '../../simulation/model/world-state';

/** One straight-alpha colour channel: `out = in * multiplier + offset` in 0-255 units. */
const ColorChannelSchema = z
  .object({
    multiplier: z.number().finite().min(-8).max(8),
    offset: z.number().finite().min(-512).max(512),
  })
  .strict()
  .readonly();

const PositiveId = z.number().int().positive();

/** Optional replacement artwork, registered like an entity visual. */
const FlashArtworkSchema = z
  .object({
    image: z.string().regex(/^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:gif|png|jpg|webp|svg)$/),
    nativeSize: z.object({ width: PositiveId, height: PositiveId }).strict().readonly(),
    /** Uniform bitmap-to-world multiplier; omitted means native pixel size. */
    scale: z.number().finite().positive().optional(),
    pivot: z
      .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), status: z.enum(['verified', 'provisional']) })
      .strict()
      .readonly(),
  })
  .strict()
  .readonly();

export const ShieldFlashAppearanceSchema = z
  .object({
    /** Colour transform applied to the flash artwork; alpha is driven separately. */
    colorTransform: z
      .object({ red: ColorChannelSchema, green: ColorChannelSchema, blue: ColorChannelSchema })
      .strict()
      .readonly(),
    /**
     * Overlay alpha (0..1, before the owner's own opacity) for each tick since
     * the trigger; index 0 is the trigger tick. Past the end the flash is over.
     */
    alphaByTick: z.array(z.number().finite().min(0).max(1)).min(1).max(120).readonly(),
    /** Omitted: the player never flashes. `requirePriorShields` demands shields > 0 before the hit. */
    player: z.object({ requirePriorShields: z.boolean() }).strict().readonly().optional(),
    /** Omitted: NPC ships never flash. Otherwise the remaining combined share must exceed this percent. */
    npc: z
      .object({ remainingDurabilityAbovePercent: z.number().finite().min(0).max(100) })
      .strict()
      .readonly()
      .optional(),
    /**
     * Ship definitions that own flash artwork. Unlisted ships never flash.
     * `artwork` omitted means the ship's own entity visual is reused.
     */
    entities: z
      .array(z.object({ entityDefinitionId: PositiveId, artwork: FlashArtworkSchema.optional() }).strict().readonly())
      .min(1)
      .readonly(),
  })
  .strict()
  .superRefine((policy, context) => {
    const ids = policy.entities.map(entity => entity.entityDefinitionId);
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: 'custom', path: ['entities'], message: 'Shield flash entities must be unique.' });
  })
  .readonly();
export type ShieldFlashAppearance = z.infer<typeof ShieldFlashAppearanceSchema>;
export type ShieldFlashArtwork = z.infer<typeof FlashArtworkSchema>;

/**
 * Convert the policy's channel transform to a row-major 5x4 colour matrix
 * whose offsets are in 0..1 units. Alpha passes through unchanged.
 */
export function shieldFlashColorMatrix(policy: ShieldFlashAppearance): number[] {
  const { red, green, blue } = policy.colorTransform;
  // prettier-ignore
  return [
    red.multiplier, 0, 0, 0, red.offset / 255,
    0, green.multiplier, 0, 0, green.offset / 255,
    0, 0, blue.multiplier, 0, blue.offset / 255,
    0, 0, 0, 1, 0,
  ];
}

type FlashActor = Extract<WorldState['entities'][number], { kind: 'player-ship' | 'npc-ship' }>;
const isFlashActor = (entity: WorldState['entities'][number]): entity is FlashActor =>
  entity.kind === 'player-ship' || entity.kind === 'npc-ship';
const strength = (condition: DurabilityComponent) => condition.hull + condition.shields;

/**
 * Track trigger ticks per actor. `maximumOf` returns a ship definition's
 * maxima for the NPC share threshold, or undefined when unknown (no flash).
 */
export function createShieldFlashTracker(
  initialWorld: WorldState,
  policy: ShieldFlashAppearance,
  maximumOf: (definitionId: number) => DurabilityComponent | undefined
) {
  const covered = new Set(policy.entities.map(entity => entity.entityDefinitionId));
  let tick = initialWorld.tick;
  let durability = new Map<string, DurabilityComponent>();
  let triggers = new Map<string, number>();

  const snapshot = (world: WorldState) =>
    new Map(world.entities.filter(isFlashActor).map(actor => [actor.id, actor.condition] as const));

  /** Whether this actor's observed loss satisfies its role's trigger rule. */
  const triggered = (actor: FlashActor, before: DurabilityComponent): boolean => {
    if (!covered.has(actor.definitionId)) return false;
    if (strength(actor.condition) >= strength(before)) return false;
    if (actor.kind === 'player-ship') {
      if (!policy.player) return false;
      return !policy.player.requirePriorShields || before.shields > 0;
    }
    if (!policy.npc) return false;
    const maximum = maximumOf(actor.definitionId);
    if (!maximum) return false;
    return combinedDurabilityPercent(actor.condition, maximum) > policy.npc.remainingDurabilityAbovePercent;
  };

  const reset = (world: WorldState): void => {
    tick = world.tick;
    durability = snapshot(world);
    triggers = new Map();
  };

  const advance = (world: WorldState): void => {
    if (world.tick === tick) return;
    tick = world.tick;
    const actors = world.entities.filter(isFlashActor);
    const live = new Set(actors.map(actor => actor.id));
    // Departed or destroyed actors drop their pending flash with them.
    triggers = new Map([...triggers].filter(([id]) => live.has(id)));
    actors.forEach(actor => {
      const before = durability.get(actor.id);
      if (before && triggered(actor, before)) triggers.set(actor.id, world.tick);
    });
    durability = snapshot(world);
  };

  reset(initialWorld);
  return Object.freeze({
    advance,
    reset,
    /** Overlay alpha for an actor at the latest observed tick; 0 means hidden. */
    sample: (id: string): number => {
      const start = triggers.get(id);
      if (start === undefined) return 0;
      return policy.alphaByTick[tick - start] ?? 0;
    },
  });
}
