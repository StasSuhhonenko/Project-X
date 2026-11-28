/** Owns the HUD's independent 13 Hz authored clock and its display-rate slide.
 * Kept as its own component so display frames re-render only the HUD plane,
 * never the whole gameplay composition (as every other BM1 panel keeps its
 * clock beside the art it animates). */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { blendFrames } from '../frame-step';
import { usePresentationClock } from '../use-presentation-clock';
import type { createHudController } from './hud-controller';

/**
 * The controller is a literal port of paired source frame scripts (end snaps,
 * unclamped single section steps, P/Q sampled inside the frame), so its next
 * position is not predicted here. Instead the plane is drawn between the
 * parentY committed before the latest authored frame and the current one: one
 * frame (at most 1/13 s) behind the source, never ahead of it or off its path,
 * and a target changed mid-motion cannot make it jump. Display frames are
 * sampled only while that pair differs; a settled HUD keeps its 13 Hz ticks
 * without display-rate renders. The stage's `data-hud-parent-y` stays authored.
 *
 * `advance` runs one authored HUD frame (the controller and any input that is
 * frame-locked to it). It is read when the timer fires, so a new callback
 * (the transport input gate) restarts neither the interval nor a blend in
 * progress. `children` paints the plane at the drawn parentY, in stage pixels;
 * it may return null while the plane is unavailable, and the clock keeps
 * running whenever `enabled`.
 */
export function HudFrameClock({
  enabled,
  framesPerSecond,
  advance,
  controller,
  children,
}: {
  readonly enabled: boolean;
  readonly framesPerSecond: number;
  readonly advance: () => void;
  readonly controller: Pick<ReturnType<typeof createHudController>, 'getSnapshot' | 'subscribe'>;
  readonly children: (drawnParentY: number) => ReactNode;
}) {
  const parentY = useSyncExternalStore(controller.subscribe, () => controller.getSnapshot().parentY);
  const [fromY, setFromY] = useState(parentY);
  const latestAdvance = useRef(advance);
  useEffect(() => {
    latestAdvance.current = advance;
  }, [advance]);
  // React renders this state update in the same pass as the controller's
  // store update, so the first drawn frame of an interval is exactly `fromY`.
  const tick = useCallback(() => {
    setFromY(controller.getSnapshot().parentY);
    latestAdvance.current();
  }, [controller]);
  // A disabled clock commits no frames (travel, unrevealed scene). Collapse a
  // pending blend so a resumed HUD starts at its committed position instead of
  // replaying the interrupted segment.
  useEffect(() => {
    if (!enabled) setFromY(controller.getSnapshot().parentY);
  }, [enabled, controller]);
  const fraction = usePresentationClock(enabled, framesPerSecond, tick, undefined, fromY !== parentY);
  return children(blendFrames(fromY, parentY, fraction));
}
