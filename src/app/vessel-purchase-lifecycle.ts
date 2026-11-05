/** Scene-owned image preflight and exact replacement rollback. Simulation and
 * saves stay locked until the new renderer acknowledges its vessel identity. */
import { createStore } from 'zustand/vanilla';
import { z } from 'zod';
import type { AppStore } from './app-store';
import type { GameModule } from '../content/game-module';
import { isVesselPurchaseIntentCurrent, purchaseVessel, VesselPurchaseIntentSchema, type VesselPurchaseIntent } from '../simulation/features/vessel-purchase';
import { selectPlayerEntity, type WorldState } from '../simulation/model/world-state';
import { preloadTravelScene } from '../rendering/travel-scene-assets';

const ViewSchema = z.object({ busy: z.boolean(), error: z.string().nullable(), viewRevision:z.number().int().nonnegative() }).strict().readonly();
export function createVesselPurchaseLifecycle(store: AppStore, gameModule: GameModule, resetInput: () => void,
  load: typeof preloadTravelScene = preloadTravelScene) {
  const view = createStore(() => ViewSchema.parse({ busy: false, error: null, viewRevision:0 }));
  let active = true;
  let revision = 0;
  let replacement: WorldState | null = null;
  const publish = (busy: boolean, error: string | null = null, replaceView = false) => {
    view.setState(ViewSchema.parse({ busy, error, viewRevision:view.getState().viewRevision + (replaceView ? 1 : 0) }), true);
    resetInput();
  };
  const rollback = () => {
    if (replacement) store.getState().rollbackVesselPurchase(replacement);
    replacement = null;
  };
  return Object.freeze({
    getSnapshot: view.getState,
    subscribe: (listener: () => void) => view.subscribe(listener),
    isBusy: () => view.getState().busy,
    activate: () => { active = true; },
    dispose: () => { active = false; revision += 1; rollback(); publish(false); },
    purchase: (input: VesselPurchaseIntent) => {
      if (!active || view.getState().busy) return;
      const intent = VesselPurchaseIntentSchema.parse(input);
      const state = store.getState();
      const source = state.world;
      if (!source || !isVesselPurchaseIntentCurrent(source, state.sessionRevision, intent)) return;
      const preview = purchaseVessel(source, gameModule, intent.vesselDefinitionId);
      if (preview === source) { publish(false, 'This vessel cannot be purchased with the current standing, cargo or resources.'); return; }
      const request = ++revision;
      publish(true);
      void load(preview, gameModule.definition).then(() => {
        if (!active || revision !== request) return;
        if (store.getState().world !== source) { publish(false, 'The purchase offer has changed. Try again.'); return; }
        replacement = store.getState().purchaseVessel(intent);
        if (!replacement) { publish(false, 'The purchase is no longer available.'); return; }
        publish(true, null, true);
      }).catch(error => {
        if (!active || revision !== request) return;
        rollback();
        publish(false, `Vessel artwork could not load: ${error instanceof Error ? error.message : String(error)}. Try again.`);
      });
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
