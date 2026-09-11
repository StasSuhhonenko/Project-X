/**
 * Zustand application state with mutation encapsulated behind named actions.
 * Game rules remain in simulation features; the store coordinates them.
 */
import { z } from 'zod';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { GameModule } from '../content/game-module';
import type { PlayerControls } from '../simulation/commands/player-controls';
import { parsePlayerState, type PlayerState } from '../simulation/model/player-state';

export const AppScreenSchema = z.enum(['main-menu', 'game']);
export type AppScreen = z.infer<typeof AppScreenSchema>;

export interface AppState {
  readonly screen: AppScreen;
  readonly player: PlayerState | null;
}

export interface AppActions {
  startGame(startId: string): void;
  returnToMenu(): void;
  updatePlayer(controls: Readonly<PlayerControls>): void;
}

/** Public store surface excludes Zustand's unrestricted `setState` mutation. */
export type AppStore = Pick<
  StoreApi<AppState & AppActions>,
  'getState' | 'getInitialState' | 'subscribe'
>;

/** Create an isolated store, allowing deterministic tests and future save slots. */
export function createAppStore(gameModule: GameModule): AppStore {
  const { catalog, definition, rules } = gameModule;
  const internalStore = createStore<AppState & AppActions>()((set, get) => ({
    screen: 'main-menu',
    player: null,
    startGame: startId => {
      const start = definition.starts.find(candidate => candidate.id === startId);
      if (!start) throw new Error(`Unknown start ${startId} for module ${definition.id}.`);
      // Clone and validate so each new session has independent state ownership.
      const player = parsePlayerState(start.player);
      set({ screen: 'game', player });
    },
    returnToMenu: () => set({ screen: 'main-menu', player: null }),
    updatePlayer: controls => {
      const player = get().player;
      if (!player) return;
      const vessel = catalog.getShipDefinition(player.entityDefinitionId);
      if (!vessel) throw new Error(`Missing active vessel ${player.entityDefinitionId}.`);
      set({ player: rules.updatePlayerMovement(player, vessel, controls) });
    },
  }));

  // Return a new facade instead of merely narrowing the TypeScript type. Raw
  // `setState` is therefore absent at runtime as well as inaccessible in types.
  return Object.freeze({
    getState: internalStore.getState,
    getInitialState: internalStore.getInitialState,
    subscribe: internalStore.subscribe,
  });
}
