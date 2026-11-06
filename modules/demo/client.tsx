/** Explicit independent client; R3 replaces only this module's spatial adapter. */
import type { GameModule } from '@engine/content/game-module';
import type { ModuleClient } from '@engine/ui/module-client';
import { createDeferredGameplay } from '@engine/ui/module-client';
import { EntryPresentation } from './entry-presentation';

export async function createModuleClient(game: GameModule): Promise<ModuleClient> {
  return Object.freeze({
    EntryPresentation,
    ...createDeferredGameplay(async () => {
      const { createGameplayClient } = await import('./gameplay-client');
      return createGameplayClient(game);
    }),
  });
}
