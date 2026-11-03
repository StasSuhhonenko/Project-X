/** Read-only cargo arithmetic shared by simulation, save validation and views. */
import type { InventoryComponent } from './entity-components';

/** Sum ordinary cargo in whole tons; resource balances are deliberately excluded.
 * Callers receive no mutable alias. The save boundary checks the aggregate's
 * safe integer range and vessel limit before publishing external quantities. */
export function totalCargoTons(cargo: InventoryComponent['cargo']): number {
  return Object.values(cargo).reduce((total, tons) => total + tons, 0);
}
