/** Bind entry commits to the menu/session that supplied the preview. */
import type { EntryPresentationProps } from '../ui/entry-presentation';
import type { AppStore } from './app-store';

/** Restored/restarted sessions cannot be replaced by a retained preview handle. */
export function createEntryStartIntent(store: AppStore, sessionRevision: number): EntryPresentationProps['onStart'] {
  return (startId, identity) => {
    const state = store.getState();
    if (state.screen !== 'main-menu' || state.sessionRevision !== sessionRevision) return;
    state.startGame(startId, identity);
  };
}
