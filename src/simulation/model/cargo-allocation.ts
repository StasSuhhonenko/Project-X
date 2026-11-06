/** Bounded position allocation shared by concrete policies. Options describe
 * actual module behavior, not a global assumption about commodity merging. */
import type { CargoTransferContext, CargoTransferPlan } from '../contracts/cargo-trade';

export function allocateCargoPositions(
  context: CargoTransferContext,
  options: { readonly everyMatchingPosition: boolean; readonly drainSale: boolean }
): CargoTransferPlan['positions'] | null {
  const { cargo, terms, side, quantityTons, slotCapacity } = context;
  const matching = cargo.filter(pod => pod.goodsId === terms.goodsId);
  const selected = options.everyMatchingPosition ? matching : matching.slice(0, 1);
  if (side === 'sell') {
    if (!selected.length) return null;
    if (!options.drainSale && selected.some(pod => pod.tons < quantityTons)) return null;
    return selected.map(pod => ({ slot: pod.slot, tons: options.drainSale ? pod.tons : quantityTons }));
  }
  if (selected.length) return selected.map(pod => ({ slot: pod.slot, tons: quantityTons }));
  const slot = Array.from({ length: slotCapacity }, (_, index) => index).find(
    slot => !cargo.some(pod => pod.slot === slot)
  );
  return slot === undefined ? null : [{ slot, tons: quantityTons }];
}

/** Contrasting modules can use ordinary linear, first-position settlement. */
export function planLinearCargoTransfer(context: CargoTransferContext): CargoTransferPlan | null {
  const positions = allocateCargoPositions(context, { everyMatchingPosition: false, drainSale: false });
  if (!positions) return null;
  return {
    positions,
    amount: positions.reduce((sum, position) => sum + position.tons, 0) * context.terms.pricePerTon,
  };
}
