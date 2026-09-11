/**
 * Browser lifecycle adapter for an active simulation scene.
 *
 * It translates focus and document visibility into explicit suspension and
 * resume operations. Listeners exist only between start() and stop().
 */
import { createFixedStepLoop, type FixedStepLoop } from '../../simulation/fixed-step-loop';
import { createBrowserFrameScheduler } from './browser-frame-scheduler';

export interface SimulationLifecycle {
  start(): void;
  stop(): void;
}

type WindowLifecycleTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;
type DocumentLifecycleTarget = Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;

interface BrowserSimulationLifecycleOptions {
  readonly framesPerSecond: number;
  readonly update: () => void;
  readonly windowTarget?: Window;
  readonly documentTarget?: Document;
  /** Test seam; production callers use the browser frame scheduler. */
  readonly loop?: FixedStepLoop;
}

/** Create a scene-scoped lifecycle. A stopped instance is safe to stop again. */
export function createBrowserSimulationLifecycle(
  options: BrowserSimulationLifecycleOptions,
): SimulationLifecycle {
  const windowTarget: WindowLifecycleTarget = options.windowTarget ?? window;
  const documentTarget: DocumentLifecycleTarget = options.documentTarget ?? document;
  const loop = options.loop ?? createFixedStepLoop(
    options.framesPerSecond,
    options.update,
    createBrowserFrameScheduler(options.windowTarget),
  );
  const suspensionReasons = new Set<'blurred' | 'hidden'>();
  let started = false;
  let suspended = false;

  const reconcile = (): void => {
    if (!started) return;
    const shouldSuspend = suspensionReasons.size > 0;
    if (shouldSuspend === suspended) return;
    suspended = shouldSuspend;
    if (shouldSuspend) {
      loop.suspend();
      return;
    }
    loop.resume();
  };

  const handleBlur = (): void => {
    suspensionReasons.add('blurred');
    reconcile();
  };
  const handleFocus = (): void => {
    suspensionReasons.delete('blurred');
    reconcile();
  };
  const handleVisibilityChange = (): void => {
    if (documentTarget.visibilityState === 'hidden') {
      suspensionReasons.add('hidden');
      reconcile();
      return;
    }
    suspensionReasons.delete('hidden');
    reconcile();
  };

  return {
    start: () => {
      if (started) return;
      started = true;
      suspensionReasons.clear();
      if (documentTarget.visibilityState === 'hidden') suspensionReasons.add('hidden');
      windowTarget.addEventListener('blur', handleBlur);
      windowTarget.addEventListener('focus', handleFocus);
      documentTarget.addEventListener('visibilitychange', handleVisibilityChange);
      loop.start();
      reconcile();
    },
    stop: () => {
      if (!started) return;
      started = false;
      windowTarget.removeEventListener('blur', handleBlur);
      windowTarget.removeEventListener('focus', handleFocus);
      documentTarget.removeEventListener('visibilitychange', handleVisibilityChange);
      suspensionReasons.clear();
      suspended = false;
      loop.stop();
    },
  };
}
