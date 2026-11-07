/** The sole selected BM1 client entry. Local trusted code chooses its adapter. */
import type { GameModule } from '@engine/content/game-module';
import type { ModuleClient } from '@engine/ui/module-client';
import { createDeferredGameplay } from '@engine/ui/module-client';
import { EntryPresentation } from './entry-presentation';
import { entryArtworkAssets } from './ui/entry/entry-scenes';
import { artworkStore } from './ui/use-artwork';

export async function createModuleClient(game: GameModule): Promise<ModuleClient> {
  // Page lifetime: the complete entry is decoded once and retained, so Return to
  // menu from gameplay needs no decode gate. Gameplay sets hold their own leases.
  const entryArtwork = artworkStore.acquire(entryArtworkAssets());
  const gameplay = createDeferredGameplay(async () => {
    const { createGameplayClient } = await import('./gameplay-client');
    return createGameplayClient(game);
  });
  return Object.freeze({
    EntryPresentation,
    loadGameplay: gameplay.loadGameplay,
    dispose: () => {
      try {
        gameplay.dispose();
      } finally {
        entryArtwork.release();
        artworkStore.dispose();
      }
    },
  });
}
