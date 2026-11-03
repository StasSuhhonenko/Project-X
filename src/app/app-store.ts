/**
 * Zustand application state with mutation encapsulated behind named actions.
 * The store owns session lifecycle and publication; pure simulation features
 * validate and calculate authoritative world transitions.
 */
import { z } from 'zod';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { GameModule } from '../content/game-module';
import type { PlayerControls } from '../simulation/commands/player-controls';
import { PlayerIdentitySchema, type PlayerIdentity } from '../simulation/model/player-identity';
import type { DestinationSelectionIntent } from '../simulation/commands/destination-selection';
import { advanceWorld as advanceWorldState } from '../simulation/features/advance-world';
import { beginPlayerRepair, cancelPlayerRepair } from '../simulation/features/repair';
import { purchaseCargo } from '../simulation/features/trade';
import { travelToSelectedDestination } from '../simulation/features/travel';
import { createSaveSnapshot, parseSaveSnapshot, type SaveSnapshot } from '../persistence/save-snapshot';
import { createStartingWorld } from '../simulation/model/world-construction';
import {
  selectPlayerEntity,
  selectWorldDestination,
  selectWorldTarget,
  type WorldState,
} from '../simulation/model/world-state';

export const AppScreenSchema = z.enum(['main-menu', 'game']);
export type AppScreen = z.infer<typeof AppScreenSchema>;

export interface AppState {
  readonly screen: AppScreen;
  readonly world: WorldState | null;
  /** Start identity retained only while a session can be retried. */
  readonly activeStartId: string | null;
  /** Remount presentation services after a restored world replaces a scene. */
  readonly sessionRevision: number;
}

export interface AppActions {
  startGame(startId: string, identity?: PlayerIdentity): void;
  restartGame(): void;
  returnToMenu(): void;
  advanceWorld(controls: Readonly<PlayerControls>): void;
  selectTarget(targetId: string | null): void;
  selectDestination(intent: DestinationSelectionIntent): void;
  travelToSelectedDestination(): WorldState | null;
  /** Revert only the exact arrival published by the last travel command. */
  rollbackFailedTravel(arrival: WorldState): void;
  finishTravel(arrival: WorldState): void;
  beginRepair(): void;
  cancelRepair(): void;
  purchaseCargo(quantityTons: number): void;
  captureSaveSnapshot(): SaveSnapshot;
  restoreSaveSnapshot(input: unknown): void;
}

/** Complete read-only state shape observed by UI selectors and adapters. */
export type AppStoreState = AppState & AppActions;

/** Public store surface excludes Zustand's unrestricted `setState` mutation. */
export type AppStore = Pick<
  StoreApi<AppStoreState>,
  'getState' | 'getInitialState' | 'subscribe'
>;

/** Create an isolated store, allowing deterministic tests and future save slots. */
export function createAppStore(gameModule: GameModule): AppStore {
  const { catalog, definition, rules } = gameModule;
  const zoomLevels = definition.viewport.zoom?.levels ?? [1];
  let pendingArrival: { readonly before: WorldState; readonly after: WorldState } | null = null;
  const internalStore = createStore<AppStoreState>()((set, get) => ({
    screen: 'main-menu',
    world: null,
    activeStartId: null,
    sessionRevision: 0,
    startGame: (startId, identity) => {
      const start = definition.starts.find(candidate => candidate.id === startId);
      if (!start) throw new Error(`Unknown start ${startId} for module ${definition.id}.`);
      // Validate the complete edited identity before constructing or publishing
      // anything. All other initial facts remain the immutable start's values.
      const player = identity === undefined ? start.player
        : { ...start.player, identity: PlayerIdentitySchema.parse(identity) };
      // Clone and validate so each new session has independent state ownership.
      const system = definition.systems.find(candidate => candidate.id === start.player.systemId);
      if (!system) throw new Error(`Missing starting system ${start.player.systemId}.`);
      const vessel = catalog.getShipDefinition(start.player.entityDefinitionId);
      if (!vessel) throw new Error(`Missing starting vessel ${start.player.entityDefinitionId}.`);
      const weaponId = vessel.startingWeaponIds[0];
      const weapon = weaponId === null ? null : catalog.getWeaponDefinition(weaponId);
      if (weaponId !== null && !weapon) throw new Error(`Missing starting primary weapon ${weaponId}.`);
      const npcVessel = start.npcSpawn
        ? catalog.getShipDefinition(start.npcSpawn.shipDefinitionId) : undefined;
      if (start.npcSpawn && !npcVessel) throw new Error(`Missing starting NPC vessel ${start.npcSpawn.shipDefinitionId}.`);
      const world = createStartingWorld(definition.calendar.initialDate, player, system, start.npcSpawn,
        weapon ? { weaponDefinitionId: weapon.id, initialCooldownFrames: weapon.cooldownFrames } : undefined,
        rules.createStartingNpc,
        npcVessel ? { hull: npcVessel.maximumHull, shields: npcVessel.maximumShields } : undefined,
        definition.lifecycle, start.systemStandingDefaults,
        start.systemStandingDefaults?.length ? start.id : undefined, definition.systems);
      // A rejected start must retain an outstanding arrival and its rollback lock.
      pendingArrival = null;
      set({ screen: 'game', activeStartId: startId, sessionRevision: get().sessionRevision + 1, world });
    },
    restartGame: () => {
      const startId = get().activeStartId;
      if (!startId) throw new Error('No active start is available to restart.');
      get().startGame(startId);
    },
    returnToMenu: () => {
      pendingArrival = null;
      set({ screen: 'main-menu', world: null, activeStartId: null });
    },
    captureSaveSnapshot: () => {
      const { world, activeStartId } = get();
      if (!world || !activeStartId) throw new Error('No game session is available to save.');
      if (pendingArrival) throw new Error('Travel must finish before saving.');
      return createSaveSnapshot(world, activeStartId, gameModule);
    },
    restoreSaveSnapshot: input => {
      // All schema and selected-content checks finish before any live state changes.
      const snapshot = parseSaveSnapshot(input, gameModule);
      pendingArrival = null;
      set({ screen: 'game', activeStartId: snapshot.startId,
        world: snapshot.world, sessionRevision: get().sessionRevision + 1 });
    },
    selectTarget: targetId => {
      if (pendingArrival) return;
      const world = get().world;
      if (!world || world.status !== 'active') return;
      set({ world: selectWorldTarget(world, targetId) });
    },
    selectDestination: intent => {
      if (pendingArrival) return;
      const world = get().world;
      if (!world || world.status !== 'active') return;
      const next = selectWorldDestination(world, intent, definition.systems.map(system => system.id));
      if (next !== world) set({ world: next });
    },
    travelToSelectedDestination: () => {
      if (pendingArrival) return null;
      const world = get().world;
      if (!world || world.status !== 'active') return null;
      const vessel = catalog.getShipDefinition(selectPlayerEntity(world).definitionId);
      if (!vessel) throw new Error('Active travel vessel definition is unavailable.');
      const next = travelToSelectedDestination(world, {
        systems: definition.systems, vessel, rules,
        resourceIds: definition.resources.map(resource => resource.id),
        daysPerMajor: definition.calendar.daysPerMajor,
        lifecycle: definition.lifecycle,
      });
      if (next === world) return null;
      pendingArrival = { before: world, after: next };
      set({ world: next });
      return next;
    },
    rollbackFailedTravel: arrival => {
      const transition = pendingArrival;
      if (!transition || transition.after !== arrival || get().world !== arrival) return;
      pendingArrival = null;
      set({ world: transition.before });
    },
    finishTravel: arrival => {
      if (pendingArrival?.after === arrival && get().world === arrival) pendingArrival = null;
    },
    beginRepair: () => {
      if (pendingArrival) return;
      const world = get().world;
      if (!world || world.status !== 'active') return;
      const player = selectPlayerEntity(world);
      const vessel = catalog.getShipDefinition(player.definitionId);
      const system = definition.systems.find(candidate => candidate.id === player.location.systemId);
      if (!vessel || !system) throw new Error('Active repair definitions are unavailable.');
      const next = beginPlayerRepair(world, { vessel, system, rules });
      if (next !== world) set({ world: next });
    },
    cancelRepair: () => {
      if (pendingArrival) return;
      const world = get().world;
      if (!world || world.status !== 'active') return;
      const next = cancelPlayerRepair(world);
      if (next !== world) set({ world: next });
    },
    purchaseCargo: quantityTons => {
      if (pendingArrival) return;
      const world = get().world;
      if (!world || world.status !== 'active') return;
      const vessel = catalog.getShipDefinition(selectPlayerEntity(world).definitionId);
      if (!vessel) throw new Error('Active trade vessel definition is unavailable.');
      const next = purchaseCargo(world, vessel, quantityTons);
      if (next !== world) set({ world: next });
    },
    advanceWorld: controls => {
      // Readiness must retain the exact committed world for rollback. Commands,
      // canvas picking and a scheduler racing a view callback cannot replace it.
      if (pendingArrival) return;
      const world = get().world;
      if (!world || world.status !== 'active') return;
      set({ world: advanceWorldState({
        world,
        controls,
        zoomLevels,
        definitions: catalog,
        rules,
        systems: definition.systems,
        lifecycle: definition.lifecycle,
      }) });
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
