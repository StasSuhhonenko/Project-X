/** Independent proof of deferred renderer configuration and scene ownership. */
import type { GameModule } from '@engine/content/game-module';
import type { GameplayClient } from '@engine/ui/module-client';
import { GameplayPresentation } from './gameplay-presentation';
import { createSpatialPresentation } from './spatial-presentation';
import { TerminalPresentation } from './terminal-presentation';

export async function createGameplayClient(game: GameModule): Promise<GameplayClient> {
  return Object.freeze({
    GameplayPresentation,
    TerminalPresentation,
    spatial: await createSpatialPresentation(game.definition),
  });
}
