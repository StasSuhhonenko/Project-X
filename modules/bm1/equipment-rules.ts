import { worldToSourceStage } from './source-geometry';
/** Source Symbol3:99010/104666 prices and Page1:18556 entry variation.
 * Ordinary guard adds half-adjustment while debit SUBTRACTS it. Empire debit
 * indexes absent entity rows106+ and is nonfinite: refuse atomically rather
 * than manufacturing a price or corrupting a resource balance. */
import type { EquipmentPriceContext, EquipmentPrice, EquipmentMarketContext, EquipmentMarket } from '../../src/simulation/contracts/equipment-rules';
import { nextRandomInteger } from '../../src/random/seeded-random';
export function evaluateEquipmentPrice({ operation, weapon, system, marketAdjustment, playerPosition, cameraZoom }: EquipmentPriceContext): EquipmentPrice | null {
  if (operation === 'sell') {
    const point = worldToSourceStage(system.planet.placement.position, playerPosition, cameraZoom);
    if (point.x < -50 || point.x > 700 || point.y < -50 || point.y > 450) return null;
    const amount = weapon.basePrice - marketAdjustment / 2;
    return amount < 0 ? null : Object.freeze({ resourceId: 'latinum', amount, minimumBalance: 0 });
  }
  if (system.governmentId === 16) return null;
  const amount = weapon.basePrice - marketAdjustment / 2;
  if (amount < 0) return null;
  return Object.freeze({ resourceId: 'latinum', amount, minimumBalance: Math.max(0, weapon.basePrice + marketAdjustment / 2), roundBalanceDown: true });
}
export function createEquipmentMarket({ system, randomState }: EquipmentMarketContext): EquipmentMarket {
  const base = nextRandomInteger(randomState, Math.abs(system.priceVariationFactor) + 1);
  const positive = nextRandomInteger(base.state, 50);
  const negative = nextRandomInteger(positive.state, 50);
  return Object.freeze({ marketAdjustment: base.value * Math.sign(system.priceVariationFactor) * 100 + positive.value - negative.value,
    randomState: negative.state });
}

/** Source base100 increments plus two independent0..49 offsets. */
export function validateEquipmentMarket(system: EquipmentMarketContext['system'], adjustment: number): boolean {
  const factor = system.priceVariationFactor;
  return Number.isInteger(adjustment) && adjustment >= Math.min(0, factor) * 100 - 49
    && adjustment <= Math.max(0, factor) * 100 + 49
    && Math.abs(adjustment - Math.round(adjustment / 100) * 100) <= 49;
}
