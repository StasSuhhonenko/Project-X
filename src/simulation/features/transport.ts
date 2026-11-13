/** Transport branches share one detached transaction. Surface work precedes
 * boarding even when surface policy is absent or the planet is out of reach. */
import type { GameModule } from '../../content/game-module';
import type { WorldState } from '../model/world-state';
import { boardSelectedShip } from './boarding';
import { transportToSurface } from './missions';

/** Store callers publish the completed return value once, or retain their prior
 * world if either policy throws. Absent boarding preserves surface identity. */
export function transport(world: WorldState, game: GameModule): WorldState {
  return boardSelectedShip(transportToSurface(world, game), game);
}
