/** Focused module pricing/entry rules. Ownership and payment stay engine-owned. */
import { z } from 'zod';
import type { ShipDefinition, WeaponDefinition } from '../../content/schemas/game-content';
import type { SystemDefinition } from '../../content/schemas/game-module';
import type { Position } from '../model/entity-components';

export const EquipmentPriceSchema = z
  .object({
    resourceId: z.string().min(1),
    amount: z.number().finite().nonnegative(),
    minimumBalance: z.number().finite().nonnegative(),
    /** Some currencies settle fractional debits to whole units after payment. */
    roundBalanceDown: z.boolean().optional(),
  })
  .strict()
  .readonly();
export type EquipmentPrice = z.infer<typeof EquipmentPriceSchema>;
export interface EquipmentPriceContext {
  readonly operation: 'purchase' | 'sell';
  readonly playerPosition: Position;
  readonly cameraZoom: number;
  readonly vessel: ShipDefinition;
  readonly weapon: WeaponDefinition;
  readonly system: SystemDefinition;
  readonly marketAdjustment: number;
}
export interface EquipmentMarketContext {
  readonly system: SystemDefinition;
  readonly randomState: number;
}
export const EquipmentMarketSchema = z
  .object({
    marketAdjustment: z.number().finite(),
    randomState: z.number().int().min(0).max(0xffffffff),
  })
  .strict()
  .readonly();
export type EquipmentMarket = z.infer<typeof EquipmentMarketSchema>;
