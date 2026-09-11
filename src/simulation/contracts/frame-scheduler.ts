/**
 * Scheduling boundary used by the fixed-step simulation driver.
 *
 * Timestamps are monotonically increasing milliseconds from an arbitrary
 * origin. The simulation depends on this contract rather than browser globals,
 * allowing deterministic tests and non-browser hosts.
 */
export interface FrameScheduler {
  requestFrame(callback: (timeMs: number) => void): number;
  cancelFrame(frameId: number): void;
}
