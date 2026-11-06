/** Source-backed BM1 planet repair policy. */
import type { RepairStartContext, RepairTickContext, RepairTickResult } from '@engine/simulation/contracts/game-rules';
import { worldToSourceStage } from './source-geometry';

const PLANET_PANEL_BOUNDS = Object.freeze({ left: -50, right: 700, top: -50, bottom: 450 });
const REPAIR_PER_FRAME = 5;

function isPlanetPanelAvailable(context: RepairStartContext): boolean {
  const stage = worldToSourceStage(context.planet.position, context.player.position, context.cameraZoom);
  return (
    stage.x >= PLANET_PANEL_BOUNDS.left &&
    stage.x <= PLANET_PANEL_BOUNDS.right &&
    stage.y >= PLANET_PANEL_BOUNDS.top &&
    stage.y <= PLANET_PANEL_BOUNDS.bottom
  );
}

/**
 * Symbol 3 exposes repair only at a populated, visible planet and only while
 * hull is damaged. Page 1 computes the preserved precedence-sensitive price
 * as `floor(maxHull - hull / 2)` and spends latinum once on entry.
 */
export function evaluateRepairStart(context: RepairStartContext) {
  if (context.player.repairing) return null;
  if (context.player.hull >= context.vessel.maximumHull) return null;
  if (context.planet.populationBillions <= 0) return null;
  if (!isPlanetPanelAvailable(context)) return null;
  const cost = Math.floor(context.vessel.maximumHull - context.player.hull / 2);
  if ((context.player.resources.latinum ?? -1) < cost) return null;
  return Object.freeze({ resourceId: 'latinum', cost });
}

/** Symbol 2 restores five hull and shield points per authored 13 Hz frame. */
export function updateRepair(context: RepairTickContext): RepairTickResult {
  if (!context.player.repairing) return Object.freeze({ ...context.player });
  const hull = Math.min(context.vessel.maximumHull, context.player.hull + REPAIR_PER_FRAME);
  const shields = Math.min(context.vessel.maximumShields, context.player.shields + REPAIR_PER_FRAME);
  const repairing = hull !== context.vessel.maximumHull || shields !== context.vessel.maximumShields;
  const notice = repairing
    ? context.player.notice
    : Object.freeze({
        sequence: (context.player.notice?.sequence ?? 0) + 1,
        code: 'repairs-complete',
        message: 'Repairs complete...',
      });
  return Object.freeze({ hull, shields, repairing, notice });
}
