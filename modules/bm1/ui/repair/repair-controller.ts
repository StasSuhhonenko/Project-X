/** Presentation-only 27-frame, non-looping source cadence. Exact keyposes are
 * held between authored keys; unavailable Flash tween execution is not guessed. */
import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import { repairContent } from './repair-content';

/** Read-only source-frame snapshot; only the controller may advance/reset it. */
export const REPAIR_LAST_FRAME = 27;
export const RepairClockSchema = z
  .object({
    frame: z.number().int().min(1).max(REPAIR_LAST_FRAME),
  })
  .strict()
  .readonly();
type RepairClock = z.infer<typeof RepairClockSchema>;
/** Creates one isolated attachment clock; callers dispose their own timers. */
export function createRepairController() {
  const store = createStore<RepairClock>(() => RepairClockSchema.parse({ frame: 1 }));
  return Object.freeze({
    subscribe: store.subscribe,
    getSnapshot: store.getState,
    // Replacement preserves the frozen validated snapshot: Zustand's ordinary
    // shallow merge would create a mutable object even from frozen input.
    reset: () => store.setState(state => (state.frame === 1 ? state : RepairClockSchema.parse({ frame: 1 })), true),
    advance: () =>
      store.setState(
        state => (state.frame === REPAIR_LAST_FRAME ? state : RepairClockSchema.parse({ frame: state.frame + 1 })),
        true
      ),
  });
}
/** Resolves an integer source frame (1..27) to its latest authored keypose. */
export function repairPose(frame: number) {
  if (!Number.isInteger(frame) || frame < 1 || frame > REPAIR_LAST_FRAME) throw Error('Invalid repair frame');
  return repairContent.poses.filter(p => p.frame <= frame).at(-1)!;
}
/** Source frame-1 sizing input uses rotated player bounds. It intentionally
 * remains separate from economic rules. Native Flash bounds are qualified. */
export function repairScale(boundsWidth: number, boundsHeight: number) {
  if (![boundsWidth, boundsHeight].every(v => Number.isFinite(v) && v > 0)) {
    throw Error('Invalid player repair dimensions');
  }
  const size = (boundsWidth + boundsHeight) / 2;
  return Object.freeze({
    x: size / (repairContent.bounds.right - repairContent.bounds.left),
    y: size / (repairContent.bounds.bottom - repairContent.bounds.top),
  });
}
