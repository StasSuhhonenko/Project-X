import { z } from 'zod';
import { PositionSchema, RuntimeEntityIdSchema } from '../../simulation/model/entity-components';

export const PresentedFrameSnapshotSchema = z
  .object({
    /** Absolute player camera position in world units. */
    camera: PositionSchema,
    /** Drawn zoom denominator in the logical viewport projection. */
    zoom: z.number().finite().positive(),
    /** Drawn entity positions minus the drawn camera, in world units. */
    relativePositions: z.partialRecord(RuntimeEntityIdSchema, PositionSchema).readonly(),
  })
  .strict()
  .readonly();
export type PresentedFrameSnapshot = z.infer<typeof PresentedFrameSnapshotSchema>;

export interface PresentedFrameSource {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => PresentedFrameSnapshot | null;
}

/** Scene-owned writer. The active view publishes frozen samples or null on disposal. */
export type PublishPresentedFrame = (frame: PresentedFrameSnapshot | null) => void;

/** Keep the read side stable across view replacements. Only overlay subscribers
 * receive display updates; there is no world or store publication. */
export function createPresentedFrameSource() {
  let snapshot: PresentedFrameSnapshot | null = null;
  const listeners = new Set<() => void>();
  const source: PresentedFrameSource = Object.freeze({
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
  });
  const publish: PublishPresentedFrame = frame => {
    if (snapshot === frame) return;
    snapshot = frame;
    listeners.forEach(listener => listener());
  };
  return { source, publish };
}
