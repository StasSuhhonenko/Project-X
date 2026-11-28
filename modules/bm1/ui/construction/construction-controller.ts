/** Transient builder ownership only. Prices, resources and placement remain host rules. */
import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import { StartConstructionIntentSchema as DraftSchema } from '@engine/simulation/features/construction';
import { stepConstructionDestination } from '../../construction-rules';
import { stepToward } from '../frame-step';

/** Symbol 3 frame 15 grows both axes by 20 percentage points per authored frame. */
export const BUILDER_GROWTH = Object.freeze({ initialScale: 0, maximumScale: 100, growthPerFrame: 20 });
export type ConstructionDraft = z.infer<typeof DraftSchema>;
const ViewSchema = z
  .object({
    draft: DraftSchema.nullable(),
    scale: z.number().min(BUILDER_GROWTH.initialScale).max(BUILDER_GROWTH.maximumScale),
    revision: z.number().int().nonnegative(),
  })
  .strict()
  .readonly();
export function createConstructionController() {
  const { initialScale, maximumScale, growthPerFrame } = BUILDER_GROWTH;
  const store = createStore(() => ViewSchema.parse({ draft: null, scale: initialScale, revision: 0 }));
  const commit = (view: z.input<typeof ViewSchema>) => store.setState(ViewSchema.parse(view), true);
  return Object.freeze({
    getSnapshot: store.getState,
    subscribe: (listener: () => void) => store.subscribe(listener),
    open: (draft: ConstructionDraft) => commit({ draft, scale: initialScale, revision: store.getState().revision + 1 }),
    close: () => commit({ ...store.getState(), draft: null, scale: initialScale }),
    advance: () => {
      const view = store.getState();
      if (!view.draft || view.scale === maximumScale) return;
      commit({ ...view, scale: stepToward(view.scale, maximumScale, growthPerFrame) });
    },
    destination: (delta: -1 | 1) => {
      const view = store.getState();
      if (!view.draft) return;
      const destinationSystemId =
        view.draft.destinationSystemId === null
          ? 1
          : stepConstructionDestination(view.draft.destinationSystemId, delta);
      commit({ ...view, draft: { ...view.draft, destinationSystemId } });
    },
  });
}
export type ConstructionController = ReturnType<typeof createConstructionController>;
/** Source notice routing is independent of whether the host accepted a command. */
export function constructionNoticeRoute(code: string): 'event' | 'hint' | null {
  if (code === 'construction-insufficient') return 'hint';
  if (code === 'construction-started' || code === 'construction-unclaimed') return 'event';
  return null;
}
/** One routing owner shared by composition and tests. Ore refusal must neither
 * detach the builder nor replace it with the event shell. */
export function presentConstructionNotice(
  code: string,
  message: string,
  controller: ConstructionController,
  hint: (message: string) => void,
  event: (message: string) => void
): void {
  const route = constructionNoticeRoute(code);
  if (route === 'hint') {
    hint(message);
    return;
  }
  if (route !== 'event') return;
  controller.close();
  event(message);
}
export function incompleteStationReport(className: string, remainingDays: number): string {
  return (
    '...Scan complete...\n\nThis incomplete station is a ' +
    className +
    '...construction will be complete in ' +
    remainingDays +
    ' days.'
  );
}
