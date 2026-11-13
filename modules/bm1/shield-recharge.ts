/**
 * Source-backed BM1 passive shield recharge for the player vessel.
 *
 * Provenance: `analysis/bm1/scripts/Symbol-2-6202.as:52-56`, inside the
 * player clip's enterFrame handler, after energy settlement and the Bajoran
 * antimatter restock and before keyboard navigation:
 *
 *     if (_root.myshields<_root.totshields and _root.myshields>0) {
 *         _root.myshields += (_root.opsshields/10)*.01;
 *     }
 *
 * `opsshields` is the Shields allocation of the UI-13 Power Distribution panel.
 * `loadplayer()` (`Page-1-25841.as:36-42`) initializes all four allocations to
 * 50 for a fresh ship. The panel is not ported yet (UI-13, functional owner
 * C17), so the allocation is the fixed source default here, exactly as the
 * energy recharge already uses the Reserves default. That yields
 * `(50 / 10) * 0.01 = 0.05` shield points per authored 13 Hz frame, i.e.
 * 0.65 points per second.
 *
 * Legacy behavior preserved on purpose: shields at exactly zero never
 * recharge. Once a hit drains them to 0 they stay at 0 until a paid repair
 * (which restores 5 points per frame regardless) brings them back.
 *
 * Deliberate deviation: Flash can overshoot `totshields` by up to one
 * increment (it only clamps on the next `loadplayer()`). The shared engine
 * forbids shields above the vessel maximum, so this policy clamps at the
 * maximum. The overshoot was invisible (the bar mask saturates) and at most
 * 0.05 points of extra absorption.
 */
import type { ShieldRechargeContext } from '@engine/simulation/contracts/shield-recharge-rules';
import { INITIAL_POWER_ALLOCATION_PERCENT } from './power-allocation';

/** Source default of the UI-13 Shields allocation, percent of the slider range. */
export const INITIAL_SHIELD_ALLOCATION_PERCENT = INITIAL_POWER_ALLOCATION_PERCENT.shields;

/** Shield points per frame for one allocation percent: `(ops/10)*.01`. */
const SHIELD_RECHARGE_PER_ALLOCATION_PERCENT = 0.01 / 10;

/** Return this frame's shields; the engine validates monotonicity and bounds. */
export function rechargePlayerShields(context: ShieldRechargeContext): number {
  // Both strict guards are the source's: a full or fully drained bank is inert.
  if (context.shields <= 0) return context.shields;
  if (context.shields >= context.maximumShields) return context.shields;
  const increment = INITIAL_SHIELD_ALLOCATION_PERCENT * SHIELD_RECHARGE_PER_ALLOCATION_PERCENT;
  return Math.min(context.maximumShields, context.shields + increment);
}
