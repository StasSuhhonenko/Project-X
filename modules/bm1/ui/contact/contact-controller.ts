/** Local contact attachment/growth only. A different selected identity removes
 * the old communication clip; closing never clears authoritative selection. */
import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import { stepToward } from '../frame-step';
import { CONTACT_LAYOUT as layout } from './contact-layout';

const RouteSchema = z.enum(['planet', 'selected']);
export const PurchaseHintSchema = z.enum(['none', 'offer', 'demand', 'busy']);
export type PurchaseHint = z.infer<typeof PurchaseHintSchema>;
const ViewSchema = z
  .object({
    route: RouteSchema.nullable(),
    id: z.string().nullable(),
    scale: z.number().min(layout.initialScale).max(layout.maximumScale),
    purchaseHint: PurchaseHintSchema,
    /** Counts opens, including a re-hail of the same contact, so display-rate
     * growth restarts with the authored scale (the clock's attachment key). */
    revision: z.number().int().nonnegative(),
  })
  .strict()
  .readonly();
/** Creates an isolated transient store with frozen snapshots and validated named
 * operations. References identify presentation inputs, never authoritative world
 * selection. Growth uses percentage points; invalid open input publishes nothing. */
export function createContactController() {
  const store = createStore(() =>
    ViewSchema.parse({
      route: null,
      id: null,
      scale: layout.initialScale,
      purchaseHint: 'none',
      revision: 0,
    })
  );
  const commit = (state: z.input<typeof ViewSchema>) => store.setState(ViewSchema.parse(state), true);
  const close = () =>
    commit({ ...store.getState(), route: null, id: null, scale: layout.initialScale, purchaseHint: 'none' });
  return Object.freeze({
    getSnapshot: store.getState,
    subscribe: (listener: () => void) => store.subscribe(listener),
    open: (route: z.infer<typeof RouteSchema>, id: string) =>
      commit({
        route: RouteSchema.parse(route),
        id: z.string().min(1).parse(id),
        scale: layout.initialScale,
        purchaseHint: 'none',
        revision: store.getState().revision + 1,
      }),
    close,
    purchaseHint: (hint: PurchaseHint) => {
      const current = store.getState();
      const validated = PurchaseHintSchema.parse(hint);
      if (current.route !== 'selected' || current.purchaseHint === validated) return;
      commit({ ...current, purchaseHint: validated });
    },
    reconcile: (planetId: string | null, selectedId: string | null) => {
      const view = store.getState();
      if (view.route === 'planet' && view.id !== planetId) close();
      if (view.route === 'selected' && view.id !== selectedId) close();
    },
    advance: () => {
      const view = store.getState();
      if (!view.route || view.scale === layout.maximumScale) return;
      commit({ ...view, scale: stepToward(view.scale, layout.maximumScale, layout.growthPerFrame) });
    },
  });
}
