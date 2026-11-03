/** Narrow invalidation for a module-authored communication outcome. */
import type { AppStoreState } from '../app/app-store';
import { selectPlayerEntity } from '../simulation/model/world-state';
import { CommunicationViewSchema, type CommunicationView } from './communication-view';

/** A shallow subscriber observes only sequence/code/message. Ordinary clock,
 * movement and damage publications must not replay or repaint the outcome. */
export function selectCommunicationView(state: AppStoreState): CommunicationView | null {
  const world = state.world;
  if (!world || world.status !== 'active') return null;
  const communication = selectPlayerEntity(world).feedback.communication;
  return communication ? CommunicationViewSchema.parse(communication) : null;
}
