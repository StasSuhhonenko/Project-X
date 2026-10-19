/** Fixed-rate simulation driver with bounded catch-up after host stalls. */
import type { FrameScheduler } from './contracts/frame-scheduler';

export interface FixedStepLoop {
  start(): void;
  suspend(): void;
  resume(): void;
  stop(): void;
}

const MAX_CATCH_UP_STEPS = 5;

/**
 * Drives authoritative updates without knowing how its host schedules frames.
 *
 * Suspending discards partial and elapsed time. This prevents focus loss or a
 * hidden page from producing stale catch-up updates when it resumes.
 */
export function createFixedStepLoop(
  framesPerSecond: number,
  update: () => void,
  scheduler: FrameScheduler,
  render?: (alpha: number) => void,
): FixedStepLoop {
  if (!Number.isFinite(framesPerSecond) || framesPerSecond <= 0) {
    throw new Error('Fixed-step frame rate must be positive.');
  }
  const frameDurationMs = 1000 / framesPerSecond;
  let phase: 'stopped' | 'running' | 'suspended' = 'stopped';
  let scheduledFrameId: number | undefined;
  let frameGeneration = 0;
  let previousTimeMs: number | undefined;
  let accumulatorMs = 0;

  const resetElapsedTime = (): void => {
    previousTimeMs = undefined;
    accumulatorMs = 0;
  };

  const cancelScheduledFrame = (): void => {
    if (scheduledFrameId === undefined) return;
    scheduler.cancelFrame(scheduledFrameId);
    scheduledFrameId = undefined;
    // Invalidates a callback even if its host delivers it after cancellation
    // and the loop has already started/resumed with a different frame ID.
    frameGeneration += 1;
  };

  const scheduleNextFrame = (): void => {
    if (phase !== 'running') return;
    const generation = ++frameGeneration;
    scheduledFrameId = scheduler.requestFrame(timeMs => {
      if (generation !== frameGeneration) return;
      tick(timeMs);
    });
  };

  const tick = (timeMs: number): void => {
    // A host can deliver a callback after cancellation. Treat it as stale so
    // stop and suspend remain hard lifecycle boundaries.
    if (phase !== 'running') return;
    scheduledFrameId = undefined;
    if (previousTimeMs === undefined) previousTimeMs = timeMs;
    accumulatorMs += Math.min(timeMs - previousTimeMs, frameDurationMs * MAX_CATCH_UP_STEPS);
    previousTimeMs = timeMs;
    let steps = 0;
    while (accumulatorMs >= frameDurationMs && steps < MAX_CATCH_UP_STEPS) {
      update();
      accumulatorMs -= frameDurationMs;
      steps += 1;
      if (phase !== 'running') return;
    }
    // Presentation sees only completed updates plus the remaining fraction.
    // It cannot change authoritative timing or request extra simulation ticks.
    render?.(Math.min(1, Math.max(0, accumulatorMs / frameDurationMs)));
    if (phase !== 'running') return;
    scheduleNextFrame();
  };

  return {
    start: () => {
      if (phase !== 'stopped') return;
      phase = 'running';
      resetElapsedTime();
      scheduleNextFrame();
    },
    suspend: () => {
      if (phase !== 'running') return;
      phase = 'suspended';
      cancelScheduledFrame();
      resetElapsedTime();
    },
    resume: () => {
      if (phase !== 'suspended') return;
      phase = 'running';
      resetElapsedTime();
      scheduleNextFrame();
    },
    stop: () => {
      if (phase === 'stopped') return;
      phase = 'stopped';
      cancelScheduledFrame();
      resetElapsedTime();
    },
  };
}
