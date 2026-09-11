/** React adapter for an injected vanilla Zustand store. */
import { createContext, useContext, type PropsWithChildren } from 'react';
import { useStore } from 'zustand';
import type { AppActions, AppState, AppStore } from './app-store';

const AppStoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({ store, children }: PropsWithChildren<{ store: AppStore }>) {
  return <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>;
}

export function useAppStore<T>(selector: (state: AppState & AppActions) => T): T {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error('useAppStore must be used inside AppStoreProvider.');
  return useStore(store, selector);
}
