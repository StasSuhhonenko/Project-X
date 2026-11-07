/** Capture/restore use the same exact-key contract as construction/operations. */
import type { GameModule } from '../content/game-module';
import { validateProgressionState } from '../simulation/model/progression-state';
import type { WorldState } from '../simulation/model/world-schema';

export function validateSavedProgression(world: WorldState, game: GameModule): void {
  validateProgressionState(world.progression, game.definition.progression);
}
