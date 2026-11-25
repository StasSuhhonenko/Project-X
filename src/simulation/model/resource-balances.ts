/** Validated resource debit shared by construction purchases and placement.
 * Undeclared currencies are invalid policy output; insufficient funds refuse. */
import { ResourceBalancesSchema, type ResourceBalances } from './entity-components';

export function debitResource(
  resources: ResourceBalances,
  resourceId: string,
  amount: number
): ResourceBalances | null {
  if (!Number.isFinite(amount) || amount < 0 || resources[resourceId] === undefined)
    throw Error('Resource debit requires a declared resource and finite nonnegative amount.');
  if (resources[resourceId]! < amount) return null;
  return ResourceBalancesSchema.parse({ ...resources, [resourceId]: resources[resourceId]! - amount });
}
