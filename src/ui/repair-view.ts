/** Payable repair facts only; eligibility and prices remain simulation policy. */
import { z } from 'zod';

export const RepairViewSchema = z.object({
  repairing: z.boolean(),
  hull: z.number().finite().nonnegative(),
  shields: z.number().finite().nonnegative(),
  /** Both quote fields are null while repairing or when service is unavailable. */
  resourceId: z.string().regex(/^[a-z][a-z0-9-]*$/).nullable(),
  cost: z.number().finite().int().nonnegative().nullable(),
}).strict().refine(view => (view.resourceId === null) === (view.cost === null)
  && (!view.repairing || view.cost === null), 'Repair quote must be complete and inactive.').readonly();
export type RepairView = z.infer<typeof RepairViewSchema>;
