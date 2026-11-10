/**
 * Optional passive shield-recharge policy for the player vessel.
 *
 * Units: shield points, the same units as `DurabilityComponent.shields` and
 * `ShipDefinition.maximumShields`. The policy runs once per fixed simulation
 * tick, after movement/energy settlement and before the tick's firing, repair,
 * NPC fire and effects. It sees only the player's pre-damage shields, so a hit
 * taken later in the same tick never cancels that tick's increment.
 *
 * The policy returns the new shield value. The engine owns the invariants: a
 * result is finite, never below the current value (recharge cannot damage) and
 * never above the vessel maximum. A module that needs a cap must clamp itself;
 * a violation is a programming error, not a silently corrected value.
 */
import { z } from 'zod';

const ShieldPoints = z.number().finite().nonnegative();

export const ShieldRechargeContextSchema = z
  .object({
    /** Current shields before this tick's recharge, in shield points. */
    shields: ShieldPoints,
    /** Active vessel maximum, in shield points. */
    maximumShields: ShieldPoints,
    /** Whether a paid repair is in progress; repair itself still runs later. */
    repairing: z.boolean(),
  })
  .strict()
  .readonly();
export type ShieldRechargeContext = z.infer<typeof ShieldRechargeContextSchema>;

/**
 * Module-owned arithmetic returning finite shield points. The engine checks the
 * answer directly each tick (finite, >= context.shields, <= maximumShields).
 * Absent from `GameRules` means shields never regenerate.
 */
export type ShieldRechargeRule = (context: ShieldRechargeContext) => number;
