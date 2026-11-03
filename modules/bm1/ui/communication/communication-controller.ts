/** Per-mounted-scene observation of the latest authoritative report. It owns no
 * simulation acknowledgment: close changes only this transient attachment. */
import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import { CommunicationViewSchema as OutcomeSchema, type CommunicationView } from '../../../../src/ui/communication-view';
import { CONTACT_LAYOUT as layout } from '../contact/contact-layout';
export type CommunicationOutcome = CommunicationView;
const ViewSchema = z.object({
  observed: z.number().int().nonnegative(),
  pending: OutcomeSchema.nullable(),
  report: OutcomeSchema.nullable(),
  scale: z.number().min(layout.initialScale).max(layout.maximumScale),
}).strict().readonly();
/** Seed from the mounted world, including restore/travel/remount, so historical
 * outcomes never replay. New reports stay pending through decode failure/retry;
 * only successful attachment advances observed. Sequence, not text, identifies
 * an outcome, permitting identical later reports to replace/reopen correctly. */
export function createCommunicationController(initial: CommunicationOutcome | null) {
  const baseline = initial ? OutcomeSchema.parse(initial).sequence : 0;
  const store = createStore(() => ViewSchema.parse({
    observed: baseline,
    pending: null,
    report: null,
    scale: layout.initialScale,
  }));
  const commit = (next: z.input<typeof ViewSchema>) => store.setState(ViewSchema.parse(next), true);
  return Object.freeze({
    getSnapshot: store.getState,
    subscribe: (listener: () => void) => store.subscribe(listener),
    observe: (outcome: CommunicationOutcome | null, available: boolean) => {
      const current = store.getState();
      const validated = outcome ? OutcomeSchema.parse(outcome) : null;
      const pending = validated && validated.sequence > current.observed ? validated : current.pending;
      if (!pending) return;
      if (available) {
        commit({ observed: pending.sequence, pending: null, report: pending, scale: layout.initialScale });
        return;
      }
      if (current.pending?.sequence === pending.sequence) return;
      commit({ ...current, pending, report: null, scale: layout.initialScale });
    },
    close: () => {
      const current = store.getState();
      if (!current.report) return;
      commit({ ...current, report: null, scale: layout.initialScale });
    },
    advance: () => {
      const current = store.getState();
      if (!current.report || current.scale === layout.maximumScale) return;
      commit({ ...current, scale: Math.min(layout.maximumScale, current.scale + layout.growthPerFrame) });
    },
  });
}
export type CommunicationController = ReturnType<typeof createCommunicationController>;
