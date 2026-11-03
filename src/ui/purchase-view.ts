/** Selected finite merchant offer; units are tons or module currency units. */
import { z } from 'zod';
import { NonNegativeNumberSchema, PositiveDefinitionIdSchema, RuntimeEntityIdSchema, SystemIdSchema } from '../simulation/model/entity-components';

const QuantitySchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const PurchaseViewSchema = z.object({
  merchantEntityId: RuntimeEntityIdSchema,
  merchantDefinitionId: PositiveDefinitionIdSchema,
  systemId: SystemIdSchema,
  goodsId: z.string().regex(/^[a-z][a-z0-9-]*$/),
  label: z.string().min(1),
  stockTons: QuantitySchema,
  pricePerTon: QuantitySchema.positive(),
  currencyId: z.string().regex(/^[a-z][a-z0-9-]*$/),
  cargoTons: QuantitySchema,
  cargoCapacity: NonNegativeNumberSchema,
  balance: NonNegativeNumberSchema,
  /** Simulation quotes for exactly one ton and the whole advertised stock. */
  canPurchaseOne: z.boolean(),
  canPurchaseStock: z.boolean(),
}).strict().readonly();
export type PurchaseView = z.infer<typeof PurchaseViewSchema>;
