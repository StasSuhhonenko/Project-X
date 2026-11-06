/** Isolated presentation clock; source Symbol146 frames1/2 both move20px.
 * Does not own a selected ID: the world alone owns target selection. */
import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import { TACTICAL_LAYOUT as layout } from './tactical-layout';

const ViewSchema = z
  .object({
    parentY: z.number().min(layout.openParentY).max(layout.closedParentY),
    open: z.boolean(),
  })
  .strict()
  .readonly();
/** Physical source key189 is Minus even while Shift changes its text to '_'.
 * Old/synthetic events without code use the two produced characters; named
 * other physical codes never gain the binding from their displayed character.
 * The caller owns modifier, editable-field and semantic-control guards. */
export function isTacticalDeselectKey(event: Readonly<{ code: string; key: string }>) {
  if (event.code) return event.code === 'Minus';
  return event.key === '-' || event.key === '_';
}
/** Creates one encapsulated transient view store. Snapshots are frozen and
 * positions use stage pixels; select changes exposure without owning selection.
 * advance consumes one source frame; the host owns clock disposal/suspension. */
export function createTacticalController() {
  const store = createStore(() => ViewSchema.parse({ parentY: layout.closedParentY, open: false }));
  const commit = (view: z.input<typeof ViewSchema>) => store.setState(ViewSchema.parse(view), true);
  return Object.freeze({
    getSnapshot: store.getState,
    subscribe: (listener: () => void) => store.subscribe(listener),
    select: (open: boolean) => {
      const view = store.getState();
      if (view.open === open) return;
      commit({ ...view, open });
    },
    advance: () => {
      const view = store.getState();
      const parentY = view.open
        ? Math.max(layout.openParentY, view.parentY - layout.pixelsPerFrame)
        : Math.min(layout.closedParentY, view.parentY + layout.pixelsPerFrame);
      if (parentY === view.parentY) return;
      commit({ ...view, parentY });
    },
  });
}
