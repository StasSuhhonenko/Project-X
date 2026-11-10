/** Scene-owned image preflight and exact replacement rollback. Simulation and
 * saves stay locked until the new renderer acknowledges its vessel identity. */
import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import type { GameModule } from '../content/game-module';
import {
  acquireFleetShip,
  FleetAcquisitionIntentSchema,
  isFleetAcquisitionIntentCurrent,
  quoteFleetAcquisition,
  type FleetAcquisitionIntent,
} from '../simulation/features/fleet';
import {
  isVesselPurchaseIntentCurrent,
  purchaseVessel,
  VesselPurchaseIntentSchema,
  type VesselPurchaseIntent,
} from '../simulation/features/vessel-purchase';
import { selectPlayerEntity, type WorldState } from '../simulation/model/world-state';
import type { AppStore } from './app-store';

const ViewSchema = z
  .object({
    busy: z.boolean(),
    error: z.string().nullable(),
    fleetBusy: z.boolean(),
    fleetMessage: z.string().nullable(),
    viewRevision: z.number().int().nonnegative(),
  })
  .strict()
  .readonly();
export function createVesselPurchaseLifecycle(
  store: AppStore,
  gameModule: GameModule,
  resetInput: () => void,
  load: (world: WorldState) => Promise<void>
) {
  const view = createStore(() =>
    ViewSchema.parse({ busy: false, error: null, fleetBusy: false, fleetMessage: null, viewRevision: 0 })
  );
  let active = true;
  let revision = 0;
  let replacement: WorldState | null = null;
  let kind: 'self' | 'fleet' = 'self';
  const isBusy = () => view.getState().busy || view.getState().fleetBusy;
  const publish = (busy: boolean, error: string | null = null, replaceView = false) => {
    view.setState(
      ViewSchema.parse({
        busy: kind === 'self' && busy,
        error: kind === 'self' ? error : null,
        fleetBusy: kind === 'fleet' && busy,
        fleetMessage: kind === 'fleet' ? error : null,
        viewRevision: view.getState().viewRevision + (replaceView ? 1 : 0),
      }),
      true
    );
    resetInput();
  };
  const rollback = () => {
    if (replacement) store.getState().rollbackVesselPurchase(replacement);
    replacement = null;
  };
  /** Both purchase paths use one prepared-art/currency/rollback lifecycle.
   * Preview worlds are detached: no debit or world draw is published by preflight. */
  const preflight = (source: WorldState, preview: WorldState, commit: () => WorldState | null) => {
    const request = ++revision;
    publish(true);
    const fail = (error: unknown) => {
      if (!active || revision !== request) return;
      rollback();
      publish(
        false,
        `Vessel artwork could not load: ${error instanceof Error ? error.message : String(error)}. Try again.`
      );
    };
    try {
      void load(preview)
        .then(() => {
          if (!active || revision !== request) return;
          if (store.getState().world !== source) {
            publish(false, 'The purchase offer has changed. Try again.');
            return;
          }
          replacement = commit();
          if (!replacement) {
            publish(false, 'The purchase is no longer available.');
            return;
          }
          publish(true, null, true);
        })
        .catch(fail);
    } catch (error) {
      fail(error);
    }
  };
  return Object.freeze({
    getSnapshot: view.getState,
    subscribe: (listener: () => void) => view.subscribe(listener),
    isBusy,
    activate: () => {
      active = true;
    },
    dispose: () => {
      active = false;
      revision += 1;
      rollback();
      publish(false);
    },
    purchase: (input: VesselPurchaseIntent) => {
      if (!active || isBusy()) return;
      kind = 'self';
      const intent = VesselPurchaseIntentSchema.parse(input);
      const state = store.getState();
      const source = state.world;
      if (!source || !isVesselPurchaseIntentCurrent(source, state.sessionRevision, intent)) return;
      const preview = purchaseVessel(source, gameModule, intent.vesselDefinitionId, intent.stationEntityId);
      if (preview === source) {
        publish(false, 'This vessel cannot be purchased with the current standing, cargo or resources.');
        return;
      }
      preflight(source, preview, () => store.getState().purchaseVessel(intent));
    },
    acquireFleet: (input: FleetAcquisitionIntent) => {
      if (!active || isBusy()) return;
      kind = 'fleet';
      const intent = FleetAcquisitionIntentSchema.parse(input);
      const state = store.getState();
      const source = state.world;
      if (!source || !isFleetAcquisitionIntentCurrent(source, state.sessionRevision, intent)) return;
      const decision = quoteFleetAcquisition(source, gameModule, intent.vesselDefinitionId, intent.stationEntityId);
      if (!decision || decision.refusal !== null) {
        publish(false, decision?.refusal ?? 'This fleet offer is unavailable.');
        return;
      }
      const preview = acquireFleetShip(source, gameModule, intent);
      if (!preview) {
        publish(false, 'This fleet offer is no longer available.');
        return;
      }
      preflight(source, preview, () => store.getState().acquireFleetShip(intent));
    },
    onViewReady: (definitionId: number) => {
      if (!replacement || selectPlayerEntity(replacement).definitionId !== definitionId) return;
      store.getState().finishVesselPurchase(replacement);
      replacement = null;
      publish(false);
    },
    onViewError: (error: Error, definitionId: number) => {
      if (!replacement || selectPlayerEntity(replacement).definitionId !== definitionId) return;
      rollback();
      publish(false, `The replacement view could not start: ${error.message}. Try again.`, true);
    },
  });
}
