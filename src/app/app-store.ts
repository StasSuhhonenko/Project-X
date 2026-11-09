/**
 * Zustand application state with mutation encapsulated behind named actions.
 * The store owns session lifecycle and publication; pure simulation features
 * validate and calculate authoritative world transitions.
 */
import { z } from 'zod';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { GameModule } from '../content/game-module';
import { assertSaveable, createSaveSnapshot, parseSaveSnapshot, type SaveSnapshot } from '../persistence/save-snapshot';
import type { DestinationSelectionIntent } from '../simulation/commands/destination-selection';
import type { PlayerControls } from '../simulation/commands/player-controls';
import type { ResourceSaleIntent } from '../simulation/contracts/cargo-trade';
import type { ResourcePurchaseIntent, ResourcePurchaseResult } from '../simulation/contracts/resource-purchase';
import { advanceWorld as advanceWorldState } from '../simulation/features/advance-world';
import { applyEquipmentIntent, initializeEquipment, type EquipmentIntent } from '../simulation/features/equipment';
import { acceptContract, negotiateContract, transportToSurface } from '../simulation/features/missions';
import { beginPlayerRepair, cancelPlayerRepair } from '../simulation/features/repair';
import { purchaseResource } from '../simulation/features/resource-purchase';
import { sellResource } from '../simulation/features/resource-sale';
import { initializeSystemVisit } from '../simulation/features/system-visit';
import { purchaseCargo } from '../simulation/features/trade';
import { travelToSelectedDestination } from '../simulation/features/travel';
import {
  isVesselPurchaseIntentCurrent,
  purchaseVessel,
  VesselPurchaseIntentSchema,
  type VesselPurchaseIntent,
} from '../simulation/features/vessel-purchase';
import {
  CargoTradeIntentSchema,
  resolveCargoTransferEnvironment,
  settleCargoTrade,
  type CargoTradeIntent,
  type CargoTradeRefusal,
} from '../simulation/model/cargo-transactions';
import type { ContractOfferRef } from '../simulation/model/mission-state';
import { PlayerIdentitySchema, type PlayerIdentity } from '../simulation/model/player-identity';
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
  acceptContract(ref: ContractOfferRef): boolean;
  negotiateContract(ref: ContractOfferRef): boolean;
  transportToSurface(): boolean;
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
  equipmentCommand(intent: EquipmentIntent): void;
  purchaseCargo(quantityTons: number): void;
  tradeCargo(intent: CargoTradeIntent): CargoTradeRefusal | null;
  sellResource(intent: ResourceSaleIntent): boolean;
  purchaseResource(intent: ResourcePurchaseIntent): ResourcePurchaseResult | null;
  purchaseVessel(intent: VesselPurchaseIntent): WorldState | null;
  finishVesselPurchase(replacement: WorldState): void;
  rollbackVesselPurchase(replacement: WorldState): void;
  captureSaveSnapshot(): SaveSnapshot;
  restoreSaveSnapshot(input: unknown): void;
}

/** Complete read-only state shape observed by UI selectors and adapters. */
export type AppStoreState = AppState & AppActions;

/** Public store surface excludes Zustand's unrestricted `setState` mutation. */
export type AppStore = Pick<StoreApi<AppStoreState>, 'getState' | 'getInitialState' | 'subscribe'>;

/** Create an isolated store, allowing deterministic tests and future save slots. */
export function createAppStore(gameModule: GameModule): AppStore {
  const { catalog, definition, rules } = gameModule;
  const zoomLevels = definition.gameplayZoomLevels;
  let pendingArrival: { readonly before: WorldState; readonly after: WorldState } | null = null;
  let pendingVessel: { readonly before: WorldState; readonly after: WorldState } | null = null;
  const transitionPending = () => pendingArrival !== null || pendingVessel !== null;
  const cargoEnvironment = resolveCargoTransferEnvironment(gameModule);
  // Gameplay commands cannot replace a terminal world or an exact transition
  // snapshot retained for renderer acknowledgment/rollback. Session recovery
  // and transition completion deliberately use their own identity guards.
  const activeWorld = (get: () => AppStoreState): WorldState | null => {
    if (transitionPending()) return null;
    const world = get().world;
    return world?.status === 'active' ? world : null;
  };
  const requireActiveVessel = (world: WorldState, message: string) => {
    const vessel = catalog.getShipDefinition(selectPlayerEntity(world).definitionId);
    if (!vessel) throw new Error(message);
    return vessel;
  };
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
      const player =
        identity === undefined ? start.player : { ...start.player, identity: PlayerIdentitySchema.parse(identity) };
      // Clone and validate so each new session has independent state ownership.
      const system = definition.systems.find(candidate => candidate.id === start.player.systemId);
      if (!system) throw new Error(`Missing starting system ${start.player.systemId}.`);
      const vessel = catalog.getShipDefinition(start.player.entityDefinitionId);
      if (!vessel) throw new Error(`Missing starting vessel ${start.player.entityDefinitionId}.`);
      const weaponId = vessel.startingWeaponIds[0];
      const weapon = weaponId === null ? null : catalog.getWeaponDefinition(weaponId);
      if (weaponId !== null && !weapon) throw new Error(`Missing starting primary weapon ${weaponId}.`);
      const npcVessel = start.npcSpawn ? catalog.getShipDefinition(start.npcSpawn.shipDefinitionId) : undefined;
      if (start.npcSpawn && !npcVessel)
        throw new Error(`Missing starting NPC vessel ${start.npcSpawn.shipDefinitionId}.`);
      const world = createStartingWorld({
        initialDate: definition.calendar.initialDate,
        player,
        system,
        npcSpawn: start.npcSpawn,
        initialPrimaryWeapon: weapon
          ? { weaponDefinitionId: weapon.id, initialCooldownFrames: weapon.cooldownFrames }
          : undefined,
        createStartingNpc: rules.createStartingNpc,
        npcDurability: npcVessel ? { hull: npcVessel.maximumHull, shields: npcVessel.maximumShields } : undefined,
        lifecycleDefinition: definition.lifecycle,
        standingDefaults: start.systemStandingDefaults,
        standingStartId: start.systemStandingDefaults?.length ? start.id : undefined,
        systems: definition.systems,
        progression: definition.progression,
      });
      const initialized = initializeSystemVisit(initializeEquipment(world, gameModule), gameModule, startId);
      // A rejected start must retain an outstanding arrival and its rollback lock.
      pendingArrival = null;
      pendingVessel = null;
      set({
        screen: 'game',
        activeStartId: startId,
        sessionRevision: get().sessionRevision + 1,
        world: initialized,
      });
    },
    restartGame: () => {
      const startId = get().activeStartId;
      if (!startId) throw new Error('No active start is available to restart.');
      get().startGame(startId);
    },
    returnToMenu: () => {
      pendingArrival = null;
      pendingVessel = null;
      set({ screen: 'main-menu', world: null, activeStartId: null });
    },
    captureSaveSnapshot: () => {
      const { world, activeStartId } = get();
      if (!world || !activeStartId) throw new Error('No game session is available to save.');
      if (pendingArrival) throw new Error('Travel must finish before saving.');
      if (pendingVessel) throw new Error('Vessel replacement must finish before saving.');
      return createSaveSnapshot(world, activeStartId, gameModule);
    },
    restoreSaveSnapshot: input => {
      // All schema and selected-content checks finish before any live state changes.
      const snapshot = parseSaveSnapshot(input, gameModule);
      pendingArrival = null;
      pendingVessel = null;
      set({
        screen: 'game',
        activeStartId: snapshot.startId,
        world: snapshot.world,
        sessionRevision: get().sessionRevision + 1,
      });
    },
    selectTarget: targetId => {
      const world = activeWorld(get);
      if (!world) return;
      set({ world: selectWorldTarget(world, targetId) });
    },
    selectDestination: intent => {
      const world = activeWorld(get);
      if (!world) return;
      const next = selectWorldDestination(
        world,
        intent,
        definition.systems.map(system => system.id)
      );
      if (next !== world) set({ world: next });
    },
    travelToSelectedDestination: () => {
      const world = activeWorld(get);
      if (!world) return null;
      const vessel = requireActiveVessel(world, 'Active travel vessel definition is unavailable.');
      let next = travelToSelectedDestination(world, {
        systems: definition.systems,
        progression: definition.progression,
        vessel,
        rules,
        resourceIds: definition.resources.map(resource => resource.id),
        daysPerMajor: definition.calendar.daysPerMajor,
        lifecycle: definition.lifecycle,
      });
      if (next === world) return null;
      next = initializeSystemVisit(next, gameModule, get().activeStartId);
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
      const world = activeWorld(get);
      if (!world) return;
      const player = selectPlayerEntity(world);
      const vessel = requireActiveVessel(world, 'Active repair definitions are unavailable.');
      const system = definition.systems.find(candidate => candidate.id === player.location.systemId);
      if (!system) throw new Error('Active repair definitions are unavailable.');
      const next = beginPlayerRepair(world, { vessel, system, rules, progression: definition.progression });
      if (next !== world) set({ world: next });
    },
    cancelRepair: () => {
      const world = activeWorld(get);
      if (!world) return;
      const next = cancelPlayerRepair(world);
      if (next !== world) set({ world: next });
    },
    equipmentCommand: intent => {
      if (transitionPending()) return;
      // Preserve equipment's parse-before-status contract: malformed intents
      // throw in an existing terminal session; valid ones are refused by the
      // feature. Missing sessions and pending transitions still short-circuit.
      const { world, sessionRevision, activeStartId } = get();
      if (!world || !activeStartId) return;
      const next = applyEquipmentIntent(world, gameModule, sessionRevision, intent);
      if (next === world) return;
      assertSaveable(next, activeStartId, gameModule);
      set({ world: next });
    },
    purchaseCargo: quantityTons => {
      const world = activeWorld(get);
      if (!world) return;
      const vessel = requireActiveVessel(world, 'Active trade vessel definition is unavailable.');
      const next = purchaseCargo(world, vessel, quantityTons, cargoEnvironment);
      if (next !== world) set({ world: next });
    },
    acceptContract: ref => {
      const world = activeWorld(get);
      if (!world) return false;
      const next = acceptContract(world, gameModule, ref);
      if (next === world) return false;
      assertSaveable(next, get().activeStartId!, gameModule);
      set({ world: next });
      return true;
    },
    negotiateContract: ref => {
      const world = activeWorld(get);
      if (!world) return false;
      const next = negotiateContract(world, gameModule, ref);
      if (next === world) return false;
      assertSaveable(next, get().activeStartId!, gameModule);
      set({ world: next });
      return true;
    },
    transportToSurface: () => {
      const world = activeWorld(get);
      if (!world) return false;
      const next = transportToSurface(world, gameModule);
      if (next === world) return false;
      assertSaveable(next, get().activeStartId!, gameModule);
      set({ world: next });
      return true;
    },
    tradeCargo: input => {
      const world = activeWorld(get);
      if (!world) return 'unavailable';
      // Cargo controls use a refusal result for malformed or stale requests.
      const intent = CargoTradeIntentSchema.safeParse(input);
      if (!intent.success || !definition.commerce) return 'unavailable';
      const vessel = catalog.getShipDefinition(selectPlayerEntity(world).definitionId);
      if (!vessel) return 'unavailable';
      const result = settleCargoTrade(
        world,
        { cargoCapacityTons: vessel.cargoCapacity, ...cargoEnvironment },
        intent.data
      );
      if (result.world !== world) set({ world: result.world });
      return result.refusal;
    },
    purchaseResource: intent => {
      const world = activeWorld(get);
      if (!world) return null;
      const outcome = purchaseResource(world, gameModule, intent);
      if (outcome.world !== world) set({ world: outcome.world });
      return outcome.result;
    },
    sellResource: intent => {
      const world = activeWorld(get);
      if (!world) return false;
      const next = sellResource(world, gameModule, intent);
      if (next === world) return false;
      set({ world: next });
      return true;
    },
    purchaseVessel: input => {
      if (transitionPending()) return null;
      // Match the vessel preflight lifecycle: malformed programmer input throws;
      // well-formed stale offers return null. Cargo controls instead consume a
      // refusal result, so their safeParse contract is deliberately different.
      const intent = VesselPurchaseIntentSchema.parse(input);
      const world = activeWorld(get);
      const { sessionRevision, activeStartId } = get();
      if (!world || !activeStartId || !isVesselPurchaseIntentCurrent(world, sessionRevision, intent)) return null;
      const replacement = purchaseVessel(world, gameModule, intent.vesselDefinitionId, intent.stationEntityId);
      if (replacement === world) return null;
      // Include selected-content/save validation before debit publication.
      assertSaveable(replacement, activeStartId, gameModule);
      pendingVessel = { before: world, after: replacement };
      set({ world: replacement });
      return replacement;
    },
    finishVesselPurchase: replacement => {
      if (pendingVessel?.after === replacement && get().world === replacement) pendingVessel = null;
    },
    rollbackVesselPurchase: replacement => {
      if (pendingVessel?.after !== replacement || get().world !== replacement) return;
      const before = pendingVessel.before;
      pendingVessel = null;
      set({ world: before });
    },
    advanceWorld: controls => {
      // Readiness must retain the exact committed world for rollback. Commands,
      // canvas picking and a scheduler racing a view callback cannot replace it.
      const world = activeWorld(get);
      if (!world) return;
      set({
        world: advanceWorldState({
          world,
          controls,
          zoomLevels,
          combatGeometry: definition.combatGeometry,
          definitions: catalog,
          rules,
          systems: definition.systems,
          progression: definition.progression,
          lifecycle: definition.lifecycle,
        }),
      });
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
