/** UI-only state; never saved. Source release3520:86 closes for every text,
 * including unknown input. */
import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import type { TextCommandIntent } from '@engine/simulation/contracts/text-command';
import { stepToward } from '../frame-step';
import { CHEAT_GROWTH as growth } from './cheat-growth';

const ViewSchema = z
  .object({
    open: z.boolean(),
    scale: z.number().int().min(growth.initialScale).max(growth.maximumScale),
    text: z.string(),
    revision: z.number().int().nonnegative(),
  })
  .strict()
  .readonly();
export function createCheatController() {
  const store = createStore(() => ViewSchema.parse({ open: false, scale: growth.initialScale, text: '', revision: 0 }));
  const commit = (next: z.input<typeof ViewSchema>) => store.setState(ViewSchema.parse(next), true);
  const close = () => commit({ ...store.getState(), open: false, text: '', scale: growth.initialScale });
  return Object.freeze({
    getSnapshot: store.getState,
    subscribe: (listener: () => void) => store.subscribe(listener),
    open: () => commit({ open: true, scale: growth.initialScale, text: '', revision: store.getState().revision + 1 }),
    close,
    setText: (text: string) => {
      if (!store.getState().open) return;
      commit({ ...store.getState(), text: z.string().parse(text) });
    },
    advance: () => {
      const current = store.getState();
      if (!current.open || current.scale === growth.maximumScale) return;
      commit({ ...current, scale: stepToward(current.scale, growth.maximumScale, growth.growthPerFrame) });
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
