/** One scene-local source-frame clock for mounted BM1 attachments. */
import { useEffect, useRef, useState } from 'react';

type Sample = Readonly<{ key: number | string | undefined; fraction: number }>;

/** Authored frames and display progress advance only while the page is visible and focused. */
const clockActive = () => document.visibilityState === 'visible' && document.hasFocus();

/** Keep the previous object for an unchanged sample, so React bails out. */
const nextSample = (key: Sample['key'], fraction: number) => (previous: Sample) =>
  previous.key === key && previous.fraction === fraction ? previous : { key, fraction };

/** Each interval advances one authored frame while the page is visible/focused.
 * Hidden time is discarded: there is no catch-up and no simulation ownership.
 * A changing attachment key rebases a replacement report on the same cadence
 * as its first mount. Callers keep stable controller methods as `advance`.
 *
 * Display-rate smoothing (2026-11-27): while `animating` is true, the hook also
 * returns how far display time has progressed toward the next authored frame,
 * as a fraction in [0, 1], refreshed on every display frame. Callers draw
 * between their current authored value and the value the next `advance` will
 * commit (see `frame-step.ts`); authored state and its cadence are unchanged.
 * The fraction is measured from the last advance (or from enabling), clamped,
 * so a late interval holds the next value instead of overshooting it. It is 0
 * whenever the clock is disabled or the caller is not animating. An unchanged
 * sample is never republished, so a settled or paused panel does not re-render
 * per display frame or per authored tick. Display time while the page is
 * unfocused or hidden, or across a stall longer than one interval, does not
 * count toward the next frame: the interval withholds that frame too. A caller
 * whose authored value restarts (a reopened panel) passes a new key.
 */
export function usePresentationClock(
  enabled: boolean,
  framesPerSecond: number,
  advance: () => void,
  attachmentKey?: number | string,
  animating = false
): number {
  const lastAdvanceAt = useRef(0);
  // A sample belongs to one attachment: a replacement report (new key) must
  // never render, even once, with its predecessor's progress.
  const [sample, setSample] = useState<Sample>({ key: attachmentKey, fraction: 0 });
  useEffect(() => {
    if (!enabled) return;
    lastAdvanceAt.current = performance.now();
    const timer = window.setInterval(() => {
      if (!clockActive()) return;
      advance();
      lastAdvanceAt.current = performance.now();
      // Batched with the controller commit, so the new authored value is
      // never drawn with the previous interval's (near-1) fraction.
      setSample(nextSample(attachmentKey, 0));
    }, 1000 / framesPerSecond);
    return () => window.clearInterval(timer);
  }, [enabled, framesPerSecond, advance, attachmentKey]);
  const smoothing = enabled && animating;
  useEffect(() => {
    if (!smoothing || typeof window.requestAnimationFrame !== 'function') return;
    const interval = 1000 / framesPerSecond;
    let request = 0;
    let previous: number | undefined;
    const draw = (now: number) => {
      const gap = previous === undefined ? 0 : now - previous;
      previous = now;
      // Paused display time shifts the interval start, freezing the sample.
      if (!clockActive() || gap > interval) lastAdvanceAt.current += gap;
      setSample(nextSample(attachmentKey, Math.min(1, Math.max(0, (now - lastAdvanceAt.current) / interval))));
      request = window.requestAnimationFrame(draw);
    };
    request = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(request);
      setSample(nextSample(attachmentKey, 0));
    };
  }, [smoothing, framesPerSecond, attachmentKey]);
  return smoothing && sample.key === attachmentKey ? sample.fraction : 0;
}
