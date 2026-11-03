/** Private presentation selectors and source-frame progression. World state,
 * storage and gameplay rules cannot be reached from these named operations. */
import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import { HudActionSchema, type HudAction } from './hud-content';
import { HUD_LAYOUT } from './hud-layout';
const SectionSchema = z.enum(['default', 'cargo', 'statistics', 'power', 'fleet']);
const ViewSchema = z.object({
  section: SectionSchema,
  menu: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  parentY: z.number().finite(),
  phase: z.union([z.literal(0), z.literal(1)]),
  hint: z.string(),
  toolsOpen: z.boolean(),
}).readonly();

/** Creates isolated transient HUD ownership for one presentation mount.
 * Snapshots are validated/frozen; subscribers never acquire a writable store.
 * Keys are sampled by advance(), never used to mutate simulation state.
 * Invalid action input throws before publication. Positions use stage pixels. */
export function createHudController() {
  const store = createStore(() => ViewSchema.parse({
    section: 'default', menu: 0, parentY: HUD_LAYOUT.initialParentY,
    phase: 0, hint: '', toolsOpen: false,
  }));
  let heldP = false;
  let heldQ = false;
  const commit = (view: z.input<typeof ViewSchema>) => store.setState(ViewSchema.parse(view), true);
  return Object.freeze({
    getSnapshot: store.getState,
    subscribe: (listener: () => void) => store.subscribe(listener),
    key: (key: 'p' | 'q', down: boolean) => {
      if (key === 'p') heldP = down;
      if (key === 'q') heldQ = down;
    },
    releaseKeys: () => {
      heldP = false;
      heldQ = false;
    },
    hint: (hint: string) => commit({ ...store.getState(), hint }),
    showTools: () => commit({ ...store.getState(), toolsOpen: true }),
    hideTools: () => commit({ ...store.getState(), toolsOpen: false }),
    /** Explicit browser dismissal for reference panels without a consumed
     * source Close command (not a fabricated fleet control or source shortcut). */
    dismiss: () => commit({ ...store.getState(), section: 'default', menu: 0, hint: '', toolsOpen: false }),
    activate: (input: HudAction) => {
      const action = HudActionSchema.parse(input);
      const view = store.getState();
      if (action === 'unavailable') return false;
      if (action === 'map') {
        // The concrete map controller owns its attachment. Source openmap
        // closes the HUD; browser tools remain a distinct explicit action.
        commit({ ...view, section: 'default', menu: 0, hint: '' });
        return true;
      }
      if (action === 'rollover') {
        if (view.menu === 0) commit({ ...view, section: 'default', menu: 1 });
        return true;
      }
      if (action === 'close-statistics') {
        commit({ ...view, section: 'default', menu: 1 });
        return true;
      }
      if (action === 'close-cargo' || action === 'close-power') {
        commit({ ...view, section: 'default' });
        return true;
      }
      if (action === 'statistics' || action === 'fleet') {
        commit({ ...view, section: action, menu: 2, phase: 0 });
        return true;
      }
      commit({ ...view, section: action, menu: 1, phase: 0 });
      return true;
    },
    /** Handler coordinates belong to the enclosing Symbol6 timeline. The
     * caller first converts browser pixels to stage then subtracts its parent. */
    rollOut: (localX: number, localY: number) => {
      const view = store.getState();
      const outside = localX < -HUD_LAYOUT.rolloutHalfWidth
        || localX > HUD_LAYOUT.rolloutHalfWidth || localY < HUD_LAYOUT.rolloutMinimumY;
      if (view.menu === 0 || !outside) return false;
      commit({ ...view, section: 'default', menu: 0, hint: '' });
      return true;
    },
    /** One authored presentation frame, independently scheduled at 13Hz.
     * Cargo/statistics move only on the first paired script and intentionally
     * retain its unclamped source behavior. Power has its separate reset path. */
    advance: () => {
      const view = store.getState();
      let parentY = view.parentY;
      let section = view.section;
      let menu = view.menu;
      const first = view.phase === 0;
      const step = HUD_LAYOUT.pixelsPerFrame;
      // Fleet frame9:57632 applies Q before its movement; frame10:59376 does
      // not repeat that key clause. Retain this distinct order and pair owner.
      if (view.section === 'fleet' && first && heldQ) {
        menu = 0;
        section = 'default';
      }
      if (section === 'default' || section === 'fleet') {
        const target = menu === 0 ? HUD_LAYOUT.closedParentY
          : menu === 1 ? HUD_LAYOUT.menuParentY : HUD_LAYOUT.expandedParentY;
        if (parentY > target && menu !== 0) parentY = Math.max(target, parentY - step);
        if (parentY < target && menu === 0) parentY = Math.min(target, parentY + step);
        if (menu !== 0 && parentY < target) parentY = target;
        if (menu === 0 && parentY > HUD_LAYOUT.closedParentY) parentY = HUD_LAYOUT.closedParentY;
      }
      if (first && section === 'cargo') {
        if (view.menu === 2) {
          parentY -= step;
          section = 'default';
        }
        if (view.menu === 1 && parentY > HUD_LAYOUT.menuParentY) parentY -= step;
        if (view.menu === 0) {
          parentY += step;
          section = 'default';
        }
      }
      if (first && section === 'statistics') {
        if (view.menu === 2 && parentY > HUD_LAYOUT.expandedParentY) parentY -= step;
        if (view.menu === 0) {
          parentY += step;
          section = 'default';
        }
      }
      if (first && section === 'power' && view.menu !== 1) {
        parentY += view.menu === 0 ? step : -step;
        section = 'default';
      }
      // Key clauses execute after source movement. Only default frame1 owns P;
      // cargo/statistics/power frame-entry scripts own Q after motion; fleet Q
      // was applied before movement above and never gains a P clause.
      const acceptsQ = first && view.section !== 'fleet';
      if (acceptsQ && heldQ) {
        menu = 0;
        section = 'default';
      }
      if (first && view.section === 'default' && heldP) {
        menu = 1;
        section = 'default';
      }
      commit({ ...view, section, menu, parentY, phase: view.phase === 0 ? 1 : 0,
        ...(acceptsQ && heldQ ? { hint: '', toolsOpen: false } : {}) });
    },
  });
}
