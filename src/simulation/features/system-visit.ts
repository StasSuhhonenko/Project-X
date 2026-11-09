/** Sole start/arrival entry composition. Spatial stations (and existing
 * defenders) must already be constructed. Restore deliberately bypasses this. */
import type { GameModule } from '../../content/game-module';
import { freezeWorld } from '../model/world-schema';
import type { WorldState } from '../model/world-state';
import { initializeCommerce } from './commerce';
import { enterEquipmentMarket } from './equipment';
import { initializeVisitEncounters } from './visit-encounters';
import { initializeVisitMissions } from './visit-missions';

/** Pure detached composition; callers publish only after every stage succeeds. */
export function initializeSystemVisit(world: WorldState, game: GameModule, startId: string | null): WorldState {
  const entered = freezeWorld({ ...world, entryActorSlotCount: world.specialActorSlots.length });
  const encountered = initializeVisitEncounters(entered, game);
  const equipped = enterEquipmentMarket(encountered, game);
  const traded = initializeCommerce(equipped, game, startId);
  return initializeVisitMissions(traded, game);
}
