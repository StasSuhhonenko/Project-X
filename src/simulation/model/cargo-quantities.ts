/** Read-only cargo arithmetic shared by simulation, save validation and views. */
import type { InventoryComponent } from './entity-components';

/** Sum ordinary cargo in whole tons; resource balances are deliberately excluded.
 * Callers receive no mutable alias. The save boundary checks the aggregate's
 * safe integer range and vessel limit before publishing external quantities. */
export function totalCargoTons(cargo: InventoryComponent['cargo']): number {
  return cargo.reduce((total, pod) => total + pod.tons, 0);
}

/** Derived commodity aggregate; never persisted alongside occupied positions. */
export function cargoTonsForGoods(cargo: InventoryComponent['cargo'], goodsId: string): number {
  return cargo.filter(pod => pod.goodsId === goodsId).reduce((total, pod) => total + pod.tons, 0);
}
