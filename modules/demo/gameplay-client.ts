/** Independent proof of deferred renderer configuration and scene ownership. */
import type { GameModule } from '../../src/content/game-module';
import type { GameplayClient } from '../../src/ui/module-client';
import { GameplayPresentation } from './gameplay-presentation';
import { TerminalPresentation } from './terminal-presentation';
import { createSpatialPresentation } from './spatial-presentation';

export async function createGameplayClient(game: GameModule): Promise<GameplayClient> {
  return Object.freeze({ GameplayPresentation, TerminalPresentation,
    spatial: await createSpatialPresentation(game.definition) });
}
