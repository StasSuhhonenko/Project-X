/** Frozen contact projections for narrow host subscriptions and module inspection. */
import type { AppStoreState } from '../app/app-store';
import { selectPlayerEntity, selectSelectedWorldTarget } from '../simulation/model/world-state';
import type { PlanetContactView, SelectedContactView } from './contact-view';

/** Project the live current-system planet, without retaining entity aliases. */
export function selectPlanetContactView(state: AppStoreState): PlanetContactView | null {
  const world = state.world;
  if (!world || world.status !== 'active') return null;
  const player = selectPlayerEntity(world);
  const planet = world.entities.find(entity => entity.kind === 'planet'
    && entity.location.systemId === player.location.systemId);
  if (!planet) return null;
  return Object.freeze({ kind: 'planet', id: planet.id, systemId: planet.location.systemId,
    relativeX: planet.location.position.x - player.location.position.x,
    relativeY: planet.location.position.y - player.location.position.y });
}

/**
 * Selection owns contact identity. Condition/stock changes are intentionally
 * irrelevant to this bounded inspection capability, unlike the tactical view.
 * Destruction, deselection, travel and restoration use the authoritative lifecycle.
 */
export function selectSelectedContactView(state: AppStoreState): SelectedContactView | null {
  const world = state.world;
  if (!world || world.status !== 'active') return null;
  const contact = selectSelectedWorldTarget(world);
  if (!contact) return null;
  const player = selectPlayerEntity(world);
  const identity = { id: contact.id, systemId: contact.location.systemId,
    definitionId: contact.definitionId,
    relativeX: contact.location.position.x - player.location.position.x,
    relativeY: contact.location.position.y - player.location.position.y };
  if (contact.kind === 'station') {
    return Object.freeze({ ...identity, kind: contact.kind, stationId: contact.stationId });
  }
  return Object.freeze({ ...identity, kind: contact.kind });
}
