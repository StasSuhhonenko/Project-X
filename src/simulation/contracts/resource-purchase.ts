/** Optional planet resource exchange. Quantities are resource units, independent
 * of cargo pods. Modules own pricing, capacity and presentation messages. */
import { z } from 'zod';
import type { ShipDefinition } from '../../content/schemas/game-content';
import { CargoGoodsIdSchema } from '../model/cargo-state';
import type { ResourceSaleContext } from './cargo-trade';

export const ResourcePurchaseIntentSchema = z.object({ resourceId: CargoGoodsIdSchema }).strict().readonly();
export type ResourcePurchaseIntent = z.infer<typeof ResourcePurchaseIntentSchema>;
/** Zero transfers carry source refusal feedback without inventing a debit. */
export const ResourcePurchaseResultSchema = z
  .object({
    resourceId: CargoGoodsIdSchema,
    currencyId: CargoGoodsIdSchema,
    quantityUnits: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
    amount: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
    notice: z.string().min(1).max(160).optional(),
    description: z.string().min(1).max(500).optional(),
  })
  .strict()
  .readonly();
export type ResourcePurchaseResult = z.infer<typeof ResourcePurchaseResultSchema>;
export interface ResourcePurchaseContext extends Omit<ResourceSaleContext, 'all'> {
  readonly vessel: ShipDefinition;
}
