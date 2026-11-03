/** Project selected identity, available condition and player-relative geometry. */
import type { AppStoreState } from '../app/app-store';
import { selectPlayerEntity, selectSelectedWorldTarget } from '../simulation/model/world-state';
import type { SelectedTargetView } from './selected-target-view';

type StationStrengthView = NonNullable<Extract<SelectedTargetView, { kind: 'station' }>['combat']>;
/** Immutable component identities permit stable shallow subscriptions. Weak keys
 * retain neither departed scenes nor an alternative owner of condition. */
const strengthViews = new WeakMap<object, StationStrengthView>();
function strengthView(combat: { readonly strength: number; readonly maximumStrength: number } | null): StationStrengthView | null {
  if (!combat) return null;
  const cached = strengthViews.get(combat);
  if (cached) return cached;
  const view = Object.freeze({ strength: combat.strength, maximumStrength: combat.maximumStrength });
  strengthViews.set(combat, view);
  return view;
}

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
      displayName: target.generation?.name ?? null, hull: target.condition.hull, shields: target.condition.shields });
  }
  return Object.freeze({ ...identity, kind: target.kind, stationId: target.stationId,
    combat: strengthView(target.combat) });
}
