/** Independent repair policy proving the shared engine contract is replaceable. */
import type { RepairStartContext, RepairTickContext } from '../../src/simulation/contracts/game-rules';

export function evaluateRepairStart(context: RepairStartContext) {
  if (context.player.repairing || context.planet.populationBillions <= 0) return null;
  if (context.player.hull >= context.vessel.maximumHull
    && context.player.shields >= context.vessel.maximumShields) return null;
  const dx = context.planet.position.x - context.player.position.x;
  const dy = context.planet.position.y - context.player.position.y;
  if (dx * dx + dy * dy > 200 * 200) return null;
  const missing = context.vessel.maximumHull - context.player.hull
    + context.vessel.maximumShields - context.player.shields;
  const cost = Math.ceil(missing / 4);
  if ((context.player.resources.credits ?? -1) < cost) return null;
  return Object.freeze({ resourceId: 'credits', cost });
}

export function updateRepair(context: RepairTickContext) {
  const hull = Math.min(context.vessel.maximumHull, context.player.hull + 2);
  const shields = Math.min(context.vessel.maximumShields, context.player.shields + 1);
  const repairing = hull !== context.vessel.maximumHull || shields !== context.vessel.maximumShields;
  const notice = repairing ? context.player.notice : Object.freeze({
    sequence: (context.player.notice?.sequence ?? 0) + 1,
    code: 'service-complete',
    message: 'Field service complete.',
  });
  return Object.freeze({ hull, shields, repairing, notice });
}
