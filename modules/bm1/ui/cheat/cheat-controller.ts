/** UI-only state; never saved. Symbol3 frame27:116549 grows by20 percent per
 * source frame; release3520:86 closes for every text, including unknown input. */
import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import type { TextCommandIntent } from '@engine/simulation/contracts/text-command';

const ViewSchema = z
  .object({
    open: z.boolean(),
    scale: z.number().int().min(0).max(100),
    text: z.string(),
    revision: z.number().int().nonnegative(),
  })
  .strict()
  .readonly();
export function createCheatController() {
  const store = createStore(() => ViewSchema.parse({ open: false, scale: 0, text: '', revision: 0 }));
  const commit = (next: z.input<typeof ViewSchema>) => store.setState(ViewSchema.parse(next), true);
  const close = () => commit({ ...store.getState(), open: false, text: '', scale: 0 });
  return Object.freeze({
    getSnapshot: store.getState,
    subscribe: (listener: () => void) => store.subscribe(listener),
    open: () => commit({ open: true, scale: 0, text: '', revision: store.getState().revision + 1 }),
    close,
    setText: (text: string) => {
      if (!store.getState().open) return;
      commit({ ...store.getState(), text: z.string().parse(text) });
    },
    advance: () => {
      const current = store.getState();
      if (!current.open || current.scale === 100) return;
      commit({ ...current, scale: Math.min(100, current.scale + 20) });
    },
    submit: (onSubmit?: (intent: TextCommandIntent) => boolean) => {
      const current = store.getState();
      if (!current.open) return;
      try {
        onSubmit?.({ text: current.text });
      } finally {
        close();
      }
    },
  });
}
export type CheatController = ReturnType<typeof createCheatController>;
