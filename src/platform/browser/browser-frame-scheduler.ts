/** Browser implementation of the simulation's host-neutral frame contract. */
import type { FrameScheduler } from '../../simulation/contracts/frame-scheduler';

/**
 * Wraps requestAnimationFrame so browser scheduling stays outside simulation.
 * The returned adapter owns no callbacks after their IDs are cancelled.
 */
export function createBrowserFrameScheduler(target: Window = window): FrameScheduler {
  return Object.freeze({
    requestFrame: (callback: (timeMs: number) => void) => target.requestAnimationFrame(callback),
    cancelFrame: (frameId: number) => target.cancelAnimationFrame(frameId),
  });
}
