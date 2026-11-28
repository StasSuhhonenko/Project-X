/**
 * The one rule for BM1's per-frame UI motions (panel growth in percent, the
 * tactical panel's slide in logical pixels): each authored frame moves a value
 * a fixed step toward its target without overshooting it. Controllers use
 * `stepToward` to commit authored frames; presentations use `displayedStep` to
 * draw between the committed value and the next one at display rate, with the
 * fraction from `usePresentationClock`. The source scripts change these values
 * linearly per frame, so the blend fills in that same line and both endpoints
 * stay exact. Units are the caller's.
 *
 * Motions whose next authored value cannot be predicted from one rule (the
 * HUD's literal port of paired source frame scripts) use `blendFrames` between
 * the previous and the current committed values instead: one authored frame
 * behind, but never ahead of or off the authored path.
 */
export function stepToward(current: number, target: number, step: number): number {
  if (current < target) return Math.min(target, current + step);
  return Math.max(target, current - step);
}

/** Display value a `fraction` (0..1, clamped) of the way from `from` to `to`. */
export function blendFrames(from: number, to: number, fraction: number): number {
  return from + (to - from) * Math.min(1, Math.max(0, fraction));
}

/** Display value a `fraction` (0..1) of the way to the next authored frame. */
export function displayedStep(current: number, target: number, step: number, fraction: number): number {
  return blendFrames(current, stepToward(current, target, step), fraction);
}
