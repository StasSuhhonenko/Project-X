/** Frozen captain and standing facts for module-owned status/access selectors.
 * No labels, thresholds or derived prestige belong to the host. */
import { z } from 'zod';
import type { AppStoreState } from '../app/app-store';
import { ProgressionStateSchema } from '../simulation/model/progression-schema';
import { SystemStandingViewSchema } from './system-standing-view';

export const ProgressionViewSchema = z
  .object({
    captain: ProgressionStateSchema.nullable(),
    systemStanding: z.array(SystemStandingViewSchema).readonly(),
  })
  .strict()
  .readonly();
export type ProgressionView = z.infer<typeof ProgressionViewSchema>;

/** World parsing freezes both nested collections; forward only those views. */
export function selectProgressionView(state: AppStoreState): ProgressionView | null {
  const world = state.world;
  if (!world || world.status !== 'active') return null;
  return Object.freeze({ captain: world.progression, systemStanding: world.lifecycle.systemStanding });
}
