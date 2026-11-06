/** Per-mounted-entry presentation state. No simulation, browser storage, clocks
 * or legacy globals are retained here. Returning from preview intentionally
 * restores the recovered neutral choice rather than resuming a prior faction. */
import { z } from 'zod';
import { createStore } from 'zustand/vanilla';

const RouteSchema = z.enum(['menu', 'options', 'keys', 'saved', 'start', 'preview', 'instructions']);
const SelectionSchema = z.enum([
  'neutral-entry',
  'neutral',
  'earth',
  'klingon',
  'ferengi',
  'romulan',
  'cardassian',
  'gul',
  'dominion',
  'borg',
  'vulcan',
]);
/** Release-time gesture data: not a progression or authorization credential. */
export const EntrySelectionRequestSchema = z
  .object({ selection: SelectionSchema, shiftKey: z.boolean() })
  .strict()
  .readonly();
const NavigationSchema = RouteSchema.exclude(['preview']);
const ViewSchema = z.object({ route: RouteSchema, selection: SelectionSchema }).readonly();
export type EntryRoute = z.infer<typeof RouteSchema>;
export type EntrySelection = z.infer<typeof SelectionSchema>;
/** The source guards only the release gesture for these alternate choices. */
const requiresShiftRelease = (selection: EntrySelection) =>
  selection === 'gul' || selection === 'dominion' || selection === 'borg';
/** The two neutral requests deliberately retain distinct save/restart identities.
 * Selection/preview never creates a world; only Engage sends this immutable ID. */
const startIds = {
  'neutral-entry': 'neutral-entry',
  neutral: 'neutral-humanoid',
  earth: 'earth-officer',
  klingon: 'klingon-warrior',
  ferengi: 'ferengi-merchant',
  romulan: 'romulan-soldier',
  cardassian: 'cardassian-minion',
  gul: 'cardassian-gul',
  dominion: 'dominion-soldier',
  borg: 'borg',
  vulcan: 'vulcan-explorer',
} as const;
export const entryStartId = (selection: EntrySelection) => startIds[SelectionSchema.parse(selection)];
/** A missing definition may still be previewed as source ink, but cannot become
 * a host request. The host independently revalidates every published start ID. */
export function entryStartRequest(selection: EntrySelection, starts: readonly { readonly id: string }[]) {
  const startId = entryStartId(selection);
  return starts.some(start => start.id === startId) ? startId : null;
}
export function createEntryController() {
  const store = createStore(() => ViewSchema.parse({ route: 'menu', selection: 'neutral-entry' }));
  const commit = (route: EntryRoute, selection: EntrySelection) =>
    store.setState(ViewSchema.parse({ route, selection }), true);
  return Object.freeze({
    getSnapshot: store.getState,
    subscribe: (listener: () => void) => store.subscribe(listener),
    open: (route: z.infer<typeof NavigationSchema>) =>
      commit(NavigationSchema.parse(route), route === 'start' ? 'neutral-entry' : store.getState().selection),
    choose: (selection: EntrySelection) => {
      if (store.getState().route !== 'start' || requiresShiftRelease(selection)) return false;
      const parsed = SelectionSchema.safeParse(selection);
      if (!parsed.success) return false;
      commit('start', parsed.data);
      return true;
    },
    /** Validate before publishing; failed Shift/unknown requests preserve the exact view. */
    selectRelease: (request: unknown) => {
      if (store.getState().route !== 'start') return false;
      const parsed = EntrySelectionRequestSchema.safeParse(request);
      if (!parsed.success) return false;
      if (requiresShiftRelease(parsed.data.selection) && !parsed.data.shiftKey) return false;
      commit('start', parsed.data.selection);
      return true;
    },
    preview: () => {
      if (store.getState().route !== 'start') return false;
      commit('preview', store.getState().selection);
      return true;
    },
    return: () => {
      if (store.getState().route === 'preview') {
        commit('start', 'neutral-entry');
        return;
      }
      if (store.getState().route === 'keys') {
        commit('options', 'neutral-entry');
        return;
      }
      commit('menu', 'neutral-entry');
    },
  });
}
