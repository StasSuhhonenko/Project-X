/** Project selected identity, available condition and player-relative geometry. */
import type { AppStoreState } from '../app/app-store';
import { selectPlayerEntity, selectSelectedWorldTarget } from '../simulation/model/world-state';
import type { SelectedTargetView } from './selected-target-view';

/**
 * A flat frozen projection permits shallow subscriptions without retaining world
 * aliases. Movement is relevant only when it changes the relative target vector;
 * clocks, random state, resources and other entities are intentionally omitted.
 */
export function selectSelectedTargetView(state: AppStoreState): SelectedTargetView | null {
  if (!state.world) return null;
  const target = selectSelectedWorldTarget(state.world);
  if (!target) return null;
  const player = selectPlayerEntity(state.world);
  const identity = {
    id: target.id,
    definitionId: target.definitionId,
    systemId: target.location.systemId,
    relativeX: target.location.position.x - player.location.position.x,
    relativeY: target.location.position.y - player.location.position.y,
  };
  if (target.kind === 'npc-ship') {
    return Object.freeze({ ...identity, kind: target.kind,
      hull: target.condition.hull, shields: target.condition.shields });
  }
  return Object.freeze({ ...identity, kind: target.kind, stationId: target.stationId });
}
