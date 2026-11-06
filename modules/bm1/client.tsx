/** The sole selected BM1 client entry. Local trusted code chooses its adapter. */
import type { GameModule } from '../../src/content/game-module';
import type { ModuleClient } from '../../src/ui/module-client';
import { EntryPresentation } from './entry-presentation';
import { createDeferredGameplay } from '../../src/ui/module-client';

export async function createModuleClient(game: GameModule): Promise<ModuleClient> {
  return Object.freeze({ EntryPresentation, ...createDeferredGameplay(async () => {
    const { createGameplayClient } = await import('./gameplay-client');
    return createGameplayClient(game);
  }) });
}
