/**
 * Visible-readiness gate for one game scene mount.
 *
 * Selecting a world (start, load, restart) is logical and immediate; showing it
 * is not. A scene mounts invisibly beneath the previous screen and is revealed
 * only when both its presentation reports `ready` and the spatial view has
 * completed a first frame. One gate instance belongs to exactly one session
 * revision and scene attempt: a replaced session gets a new gate, so a late
 * report from the old scene can never reveal the new one.
 *
 * Once revealed the gate is terminal: later presentation reports (incremental
 * preparation after reveal) are ignored and never hide a shown scene. A failure
 * before reveal is also terminal for this attempt; the host retries by mounting
 * a fresh scene with a fresh gate.
 */
import type { PresentationReadiness } from '../ui/gameplay-presentation';

export type SceneRevealPhase = 'preparing' | 'revealed' | 'failed';

export interface SceneRevealSnapshot {
  readonly phase: SceneRevealPhase;
  /** Human-readable cause when `phase === 'failed'`. */
  readonly error: string | null;
}

export interface SceneRevealGate {
  getSnapshot(): SceneRevealSnapshot;
  subscribe(listener: () => void): () => void;
  reportPresentation(readiness: PresentationReadiness): void;
  /** The attached spatial view has rendered one complete frame. */
  reportFirstFrame(): void;
  /** Scene attachment or preparation failed before reveal. */
  reportFailure(error: unknown): void;
}

const preparing: SceneRevealSnapshot = Object.freeze({ phase: 'preparing', error: null });
const revealed: SceneRevealSnapshot = Object.freeze({ phase: 'revealed', error: null });

export function createSceneRevealGate(): SceneRevealGate {
  let snapshot = preparing;
  let presentation: PresentationReadiness = 'pending';
  let firstFrame = false;
  const listeners = new Set<() => void>();
  const publish = (next: SceneRevealSnapshot) => {
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  const settle = () => {
    if (snapshot.phase !== 'preparing') return;
    if (presentation === 'failed') {
      publish(Object.freeze({ phase: 'failed', error: 'The game presentation could not be prepared.' }));
      return;
    }
    if (presentation === 'ready' && firstFrame) publish(revealed);
  };
  const gate: SceneRevealGate = {
    getSnapshot: () => snapshot,
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reportPresentation: readiness => {
      if (snapshot.phase !== 'preparing') return;
      presentation = readiness;
      settle();
    },
    reportFirstFrame: () => {
      if (snapshot.phase !== 'preparing' || firstFrame) return;
      firstFrame = true;
      settle();
    },
    reportFailure: error => {
      if (snapshot.phase !== 'preparing') return;
      const message = error instanceof Error && error.message ? error.message : String(error);
      publish(Object.freeze({ phase: 'failed', error: message }));
    },
  };
  return Object.freeze(gate);
}
