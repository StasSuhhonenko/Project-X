import { useSyncExternalStore } from 'react';
import type { PresentedFrameSource } from '../rendering/contracts/presented-frame';

const emptySource: PresentedFrameSource = {
  subscribe: () => () => {},
  getSnapshot: () => null,
};

/** Subscribe at the overlay boundary and allow committed geometry as a fallback. */
export function usePresentedFrame(source: PresentedFrameSource = emptySource) {
  return useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
