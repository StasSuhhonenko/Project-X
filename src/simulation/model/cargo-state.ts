/** Canonical occupied cargo positions. Slot identity is separate from goods:
 * equal commodities can occupy distinct positions and must not be merged. */
import { z } from 'zod';
export const CargoGoodsIdSchema = z.string().regex(/^[a-z][a-z0-9-]*$/);
export const CargoQuantitySchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const CargoPodSchema = z
  .object({
    slot: z.number().int().min(0).max(127),
    goodsId: CargoGoodsIdSchema,
    tons: CargoQuantitySchema,
  })
  .strict()
  .readonly();
export type CargoPod = z.infer<typeof CargoPodSchema>;
export const CargoPodsSchema = z
  .array(CargoPodSchema)
  .max(128)
  .readonly()
  .superRefine((pods, context) => {
    if (pods.some((pod, index) => index > 0 && pod.slot <= pods[index - 1]!.slot))
      context.addIssue({ code: 'custom', message: 'Occupied cargo positions must be unique and sorted.' });
    if (!Number.isSafeInteger(pods.reduce((sum, pod) => sum + pod.tons, 0)))
      context.addIssue({ code: 'custom', message: 'Cargo total exceeds supported quantity limits.' });
  });
export type CargoPods = z.infer<typeof CargoPodsSchema>;

/** Build the next occupied set without exposing a mutable state alias. Positive
 * deltas add cargo; negative deltas remove it. The transaction owner checks
 * capacity, goods ownership and financial approval before using this helper. */
export function changeCargoPods(
  pods: CargoPods,
  goodsId: string,
  changes: readonly { readonly slot: number; readonly tons: number }[],
): CargoPods {
  const slots = new Map(pods.map((pod) => [pod.slot, pod]));
  changes.forEach((change) => {
    const current = slots.get(change.slot);
    const tons = (current?.tons ?? 0) + change.tons;
    if (tons === 0) {
      slots.delete(change.slot);
      return;
    }
    slots.set(change.slot, { slot: change.slot, goodsId, tons });
  });
  return CargoPodsSchema.parse([...slots.values()].sort((a, b) => a.slot - b.slot));
}
