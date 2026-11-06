/** One authoritative age-to-scale/opacity calculation, reused by simulation
 * and hostile-save validation. Ages count completed leads after emission. */
import type { PulsePolicy } from '../contracts/special-weapon-rules';

export function pulseProgressAtAge(policy: PulsePolicy, ageTicks: number) {
  const scalePercent = policy.initialScalePercent + ageTicks * policy.growthPerTick;
  // Fade starts on the first lead strictly above the threshold. Launch itself
  // never executes a lead, even when the authored initial scale is already high.
  const firstFadeAge = Math.max(
    1,
    Math.floor((policy.fadeAfterScalePercent - policy.initialScalePercent) / policy.growthPerTick) + 1
  );
  const fades = Math.max(0, ageTicks - firstFadeAge + 1);
  // The initial alpha is exactly 100. Each write subsequently lands on the
  // declared fixed-point grid, making every later debit a whole number of cells.
  const quantum = policy.alphaQuantumPercent;
  const firstAlpha =
    quantum === 0 ? 100 - policy.fadePerTick : Math.floor((100 - policy.fadePerTick) / quantum) * quantum;
  const debit = quantum === 0 ? policy.fadePerTick : Math.ceil(policy.fadePerTick / quantum) * quantum;
  const alphaPercent = fades === 0 ? 100 : firstAlpha - (fades - 1) * debit;
  if (!Number.isFinite(scalePercent) || !Number.isFinite(alphaPercent)) throw Error('Pulse progression overflow.');
  return { scalePercent, alphaPercent };
}
