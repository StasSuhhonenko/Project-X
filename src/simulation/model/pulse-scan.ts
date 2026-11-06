/** Cursor advancement is shared by live scans and exact save replay. The
 * roster is sparse and append-only; removals preserve holes and span length. */
import type { PulsePolicy } from '../contracts/special-weapon-rules';
import { pulseProgressAtAge } from './pulse-progression';
import type { PulseScanSegment } from './special-effect-state';

/** The station span includes its leading empty slot. Any deliberate skipped
 * actors are a module-declared offset from that neutral reset base. */
export function pulseResetSlot(policy: PulsePolicy, stationSlotCount: number): number {
  const base = policy.resetCursorAt === 'after-stations' ? stationSlotCount : policy.resetCursorAt;
  return base + (policy.resetCursorOffset ?? 0);
}

export function pulseScanStart(
  policy: PulsePolicy,
  cursor: number | null,
  ageTicks: number,
  slotCount: number,
  resetAt: number
): number | null {
  const mayReset =
    policy.resetCursorAfterScalePercent === null ||
    pulseProgressAtAge(policy, ageTicks).scalePercent > policy.resetCursorAfterScalePercent;
  if ((cursor === null || cursor >= slotCount) && mayReset) return resetAt;
  return cursor;
}

/** Source undefined increment becomes one; a multi-query lead wraps only on
 * its next lead. Do not apply JavaScript's undefined++/NaN semantics here. */
export function pulseScanEnd(start: number | null, scanCount: number): number {
  return (start ?? 0) + scanCount;
}

/** Replay is sequential because the reset threshold and source undefined
 * first query affect later wraps. Policy validation caps this at 100000 leads. */
export function replayPulseCursor(
  policy: PulsePolicy,
  initialCursor: number | null,
  ageTicks: number,
  resetAt: number,
  segments: readonly PulseScanSegment[]
): number | null {
  if (ageTicks > 100000) throw Error('Pulse continuation exceeds its replay bound.');
  let cursor = initialCursor;
  let segmentIndex = 0;
  for (let age = 1; age <= ageTicks; age += 1) {
    if (segments[segmentIndex + 1]?.firstAgeTick === age) segmentIndex += 1;
    const segment = segments[segmentIndex];
    if (!segment) throw Error('Pulse cursor has no scan span witness.');
    cursor = pulseScanEnd(pulseScanStart(policy, cursor, age, segment.slotCount, resetAt), policy.scanCountPerTick);
  }
  return cursor;
}
