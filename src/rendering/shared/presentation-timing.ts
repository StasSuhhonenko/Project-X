/** Host display-time facts; these never advance authoritative simulation time. */
export interface PresentationFrame {
  /** True while the host withholds fixed updates (committed arrival/report,
   * vessel replacement or an unrevealed scene). The departure artwork itself
   * does not freeze the world: the system keeps advancing beneath it. */
  readonly worldFrozen: boolean;
}

/**
 * Own the last drawn fraction for one spatial view. While the world is frozen
 * the view keeps redrawing the fraction it last displayed, because the running
 * fixed-loop alpha would otherwise replay the final movement every source tick.
 * Sampling changes freeze bookkeeping, but only didDraw records visible
 * geometry. The caller owns transform history and performs requested rebases.
 * No world, store, browser clock, random stream or Pixi object enters this owner.
 */
export function createPresentationTiming() {
  let lastAlpha = 1;
  let frozenAlpha = 1;
  let frozen = false;

  return {
    sample(alpha: number, frame?: PresentationFrame) {
      let rebaseHistory = false;
      if (frame) {
        if (frame.worldFrozen && !frozen) frozenAlpha = lastAlpha;
        rebaseHistory = !frame.worldFrozen && frozen;
        frozen = frame.worldFrozen;
      }
      return { alpha: frozen ? frozenAlpha : alpha, rebaseHistory };
    },
    didDraw(alpha: number) {
      lastAlpha = alpha;
    },
    lastDrawnAlpha: () => lastAlpha,
  };
}
