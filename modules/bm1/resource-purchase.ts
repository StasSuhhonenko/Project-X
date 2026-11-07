/** Planet service rules recovered from Page-1-25841.as:1057–1084.
 * These are resource balances, never cargo pods or cargo tonnage. No stock,
 * standing or government pricing modifier exists in these source functions;
 * the contact presentation separately enforces hail access. */
import type { ResourcePurchaseContext, ResourcePurchaseResult } from '@engine/simulation/contracts/resource-purchase';
import { worldToSourceStage } from './source-geometry';

export function quoteResourcePurchase(context: ResourcePurchaseContext): ResourcePurchaseResult | null {
  const { resourceId, resources, vessel, system } = context;
  if (resourceId !== 'antimatter' && resourceId !== 'deuranium') return null;
  // Symbol3:93518 closes the contact outside these inclusive stage bounds.
  const point = worldToSourceStage(system.planet.placement.position, context.playerPosition, context.cameraZoom);
  if (point.x < -50 || point.x > 700 || point.y < -50 || point.y > 450) return null;
  const result = { resourceId, currencyId: 'latinum', quantityUnits: 0, amount: 0 };
  const available = system.initialPopulationBillions > 0;
  const credits = resources.latinum ?? 0;
  if (resourceId === 'deuranium') {
    if (!available) return { ...result, description: 'There is no deuranium available here.' };
    if (credits < 1000) return { ...result, notice: 'You do not have enough latinum...' };
    // Deliberately retain the source's misleading 10-unit notice: arithmetic
    // and Symbol3:43637's package description both specify 1000 units.
    return { ...result, quantityUnits: 1000, amount: 1000, notice: 'You buy 10 units of deuranium...' };
  }
  const fuel = resources.antimatter ?? 0;
  // Source fuelbar = 100 - fuel*2*efficiency/(size*100)*100.
  // Test capacity BEFORE each whole-unit increment; do not clamp the final
  // increment to a fractional threshold. Zero efficiency never fills a tank,
  // but the finite credit budget still terminates the original loop.
  const remaining = (units: number) => 100 - ((units * 2 * vessel.fuelEfficiency) / (vessel.sizeClass * 100)) * 100;
  const affordable = Math.floor(credits / 3);
  const needed =
    vessel.fuelEfficiency > 0
      ? Math.max(0, Math.ceil((vessel.sizeClass * 100) / (2 * vessel.fuelEfficiency) - fuel))
      : affordable;
  const quantityUnits = available && remaining(fuel) > 0 ? Math.min(affordable, needed) : 0;
  return {
    ...result,
    quantityUnits,
    amount: quantityUnits * 3,
    ...(!available ? { description: 'There is no Antimatter available here.' } : {}),
    ...(remaining(fuel + quantityUnits) <= 0 ? { notice: 'Your antimatter stores are full...' } : {}),
  };
}
