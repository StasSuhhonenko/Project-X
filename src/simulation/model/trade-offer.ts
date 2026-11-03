/** One merchant offer. Runtime stock may reach zero after a purchase. */
import { z } from 'zod';

const TradeIdSchema = z.string().regex(/^[a-z][a-z0-9-]*$/);
export const TradeOfferSchema = z.object({
  goodsId: TradeIdSchema,
  label: z.string().min(1),
  stockTons: z.number().int().nonnegative(),
  pricePerTon: z.number().int().positive(),
  currencyId: TradeIdSchema,
}).strict().readonly();
