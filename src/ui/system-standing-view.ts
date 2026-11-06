/** Current-system standing, owned by simulation; no progression formula lives here. */
import { z } from 'zod';
import type { AppStoreState } from '../app/app-store';
import { SystemIdSchema } from '../simulation/model/entity-components';
import { selectPlayerEntity } from '../simulation/model/world-state';

export const SystemStandingViewSchema = z
  .object({
    systemId: SystemIdSchema,
    value: z.number().finite(),
  })
  .strict()
  .readonly();
export type SystemStandingView = z.infer<typeof SystemStandingViewSchema>;

/** Copy an authored current-system fact; missing facts remain unavailable. */
export function selectSystemStandingView(state: AppStoreState): SystemStandingView | null {
  const world = state.world;
  if (!world || world.status !== 'active') return null;
  const systemId = selectPlayerEntity(world).location.systemId;
  const standing = world.lifecycle.systemStanding.find(value => value.systemId === systemId);
  return standing ? SystemStandingViewSchema.parse(standing) : null;
}
