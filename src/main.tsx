/** Browser composition root: content validation precedes state or UI creation. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app';
import { createAppStore } from './app/app-store';
import { AppStoreProvider } from './app/app-store-context';
import { loadGameModule } from './content/game-module';
import { rules } from 'selected-game-rules';
import './styles.css';

async function bootstrap(): Promise<void> {
  const host = document.querySelector<HTMLElement>('#root');
  if (!host) throw new Error('Application root element #root is missing.');

  const gameModule = await loadGameModule(rules);
  // Reviewed presentation code may validate maintained module data at import.
  // Import inside this boundary so invalid data or a missing UI chunk reaches
  // the visible startup failure path before any store/root is published.
  const { createModuleClient } = await import('selected-game-client');
  const client = await createModuleClient(gameModule);
  document.title = gameModule.definition.title;
  const store = createAppStore(gameModule);
  const root = createRoot(host);
  window.addEventListener('pagehide', () => {
    try { root.unmount(); } finally { client.dispose(); }
  }, { once: true });
  root.render(
    <StrictMode>
      <AppStoreProvider store={store}>
        <App store={store} gameModule={gameModule} entryPresentation={client.EntryPresentation}
          loadGameplay={client.loadGameplay} />
      </AppStoreProvider>
    </StrictMode>,
  );
}

void bootstrap().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  const host = document.querySelector<HTMLElement>('#root');
  if (!host) throw error;
  host.innerHTML = '';
  const failure = document.createElement('main');
  failure.className = 'startup-failure';
  failure.textContent = `The game could not start: ${message}`;
  host.appendChild(failure);
  console.error(error);
});
