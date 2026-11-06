/** Host display-time facts; these never advance authoritative simulation time. */
export interface PresentationFrame {
  readonly timeMs: number;
  readonly worldFrozen: boolean;
  readonly continueBackdrop: boolean;
}

/**
 * Own the last drawn fraction and cosmetic continuation clock for one spatial
 * view. Sampling changes clock bookkeeping, but only didDraw records visible
 * geometry. The caller owns transform history and performs requested rebases.
 * No world, store, browser clock, random stream or Pixi object enters this owner.
 */
export function createPresentationTiming(framesPerSecond: number) {
  let lastTimeMs: number | undefined;
  let lastAlpha = 1;
  let frozenAlpha = 1;
  let continuationStartAlpha = 1;
  let continuationFrames = 0;
  let frozen = false;
  let continuing = false;

  return {
    sample(alpha: number, frame?: PresentationFrame) {
      let rebaseHistory = false;
      if (frame) {
        if (frame.worldFrozen && !frozen) frozenAlpha = lastAlpha;
        rebaseHistory = !frame.worldFrozen && frozen;
        frozen = frame.worldFrozen;
        if (frame.continueBackdrop && !continuing) {
          continuationFrames = 0;
          continuationStartAlpha = lastAlpha;
        }
        if (frame.continueBackdrop && continuing && lastTimeMs !== undefined) {
          // Match the view's bounded display-gap handling; hidden time is reset
          // separately by the host's focus/visibility lifecycle.
          continuationFrames += (Math.max(0, Math.min(250, frame.timeMs - lastTimeMs)) * framesPerSecond) / 1000;
        }
        continuing = frame.continueBackdrop;
        lastTimeMs = frame.timeMs;
      }
      return {
        alpha: frozen ? frozenAlpha : alpha,
        rebaseHistory,
        continuation: continuing ? { frames: continuationFrames, startAlpha: continuationStartAlpha } : undefined,
      };
    },
    didDraw(alpha: number) {
      lastAlpha = alpha;
    },
    lastDrawnAlpha: () => lastAlpha,
    /** Discard elapsed time without changing the active world-freeze fraction.
     * The view separately resets histories/effects, then draws its reset frame. */
    reset() {
      lastTimeMs = undefined;
      continuing = false;
      continuationFrames = 0;
    },
  };
}
