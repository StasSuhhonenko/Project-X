/** One merchant offer. Runtime stock may reach zero after a purchase. */
import { z } from 'zod';
import { GoodsTermsSchema } from '../contracts/cargo-trade';

export const TradeOfferSchema = GoodsTermsSchema.unwrap()
  .extend({
    stockTons: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .strict()
  .readonly();
export type TradeOffer = z.infer<typeof TradeOfferSchema>;
