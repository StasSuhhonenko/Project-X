/** UI-only selectedfleet[0..10]. Holes preserve authored icon positions; this
 * store never enters saves. Only named operations can publish validated data. */
import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import { RuntimeEntityIdSchema } from '@engine/simulation/model/entity-components';

const IdSchema = RuntimeEntityIdSchema;
const SelectionSchema = z
  .object({
    slots: z.array(IdSchema.nullable()).length(11).readonly(),
    hoveredSlot: z.number().int().min(0).max(8).nullable(),
  })
  .strict()
  .readonly();
const empty = () => Array.from({ length: 11 }, () => null);

export function createFleetSelection() {
  const store = createStore(() => SelectionSchema.parse({ slots: empty(), hoveredSlot: null }));
  const commit = (slots: readonly (string | null)[], hoveredSlot = store.getState().hoveredSlot) =>
    store.setState(SelectionSchema.parse({ slots, hoveredSlot }), true);
  return Object.freeze({
    getSnapshot: store.getState,
    subscribe: (listener: () => void) => store.subscribe(listener),
    clear: () => commit(empty(), null),
    replace: (ids: readonly string[]) => {
      const unique = [...new Set(ids)];
      commit(
        Array.from({ length: 11 }, (_, index) => unique[index] ?? null),
        null
      );
    },
    add: (input: string) => {
      const id = IdSchema.parse(input);
      const { slots } = store.getState();
      if (slots.includes(id)) return;
      const first = slots.indexOf(null);
      if (first < 0) return;
      commit(slots.map((slot, index) => (index === first ? id : slot)));
    },
    prune: (liveIds: readonly string[]) => {
      const { slots } = store.getState();
      if (slots.every(id => id === null || liveIds.includes(id))) return;
      commit(slots.map(id => (id !== null && liveIds.includes(id) ? id : null)));
    },
    hover: (slot: number | null) => commit(store.getState().slots, slot),
    select: (slot: number) => {
      // Nine hover receivers exist; only item1 and item2 release selects.
      if (slot !== 0 && slot !== 1) return null;
      const id = store.getState().slots[slot];
      commit(store.getState().slots.map((id, index) => (index === slot ? id : null)));
      return id ?? null;
    },
  });
}
