/** One scene-local source-frame clock for mounted BM1 attachments. */
import { useEffect } from 'react';

/** Each interval advances one authored frame while the page is visible/focused.
 * Hidden time is discarded: there is no catch-up and no simulation ownership.
 * A changing attachment key rebases a replacement report on the same cadence
 * as its first mount. Callers keep stable controller methods as `advance`.
 */
export function usePresentationClock(enabled: boolean, framesPerSecond: number,
  advance: () => void, attachmentKey?: number | string) {
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && document.hasFocus()) advance();
    }, 1000 / framesPerSecond);
    return () => window.clearInterval(timer);
  }, [enabled, framesPerSecond, advance, attachmentKey]);
}
