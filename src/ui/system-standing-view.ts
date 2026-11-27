/** System standing, owned by simulation; no progression formula lives here. */
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

/** Read the requested standing scope, defaulting to the current system. */
export function selectSystemStandingView(state: AppStoreState, systemId?: number): SystemStandingView | null {
  const world = state.world;
  if (!world || world.status !== 'active') return null;
  const scope = systemId ?? selectPlayerEntity(world).location.systemId;
  const standing = world.lifecycle.systemStanding.find(value => value.systemId === scope);
  return standing ? SystemStandingViewSchema.parse(standing) : null;
}
