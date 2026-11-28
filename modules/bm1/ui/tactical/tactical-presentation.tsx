/** UI-10 sits below playerpanel, above the world. Only the authored SCAN Hit
 * consumes pointer events; transparent stage pixels remain spatial pickable. */
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { displayedStep, stepToward } from '../frame-step';
import { SourceControl } from '../source-control';
import { usePresentationClock } from '../use-presentation-clock';
import { tacticalAsset, tacticalContent } from './tactical-content';
import { createTacticalController } from './tactical-controller';
import { TACTICAL_LAYOUT as layout } from './tactical-layout';
import type { TacticalReadModel } from './tactical-read-model';

/** Symbol148 black occlusion rectangle, before its child registration. */
export const STRENGTH_COVER_PATH = 'M-85.6,-18.75 L-35.6,-18.75 L-35.6,-5.65 L-85.6,-5.65 Z';

/** SVG transform for the strength cover at the settled open position. Source
 * action 1313 sets `strengthbar._xscale`, which scales about the instance
 * origin: the right end stays at stage x 53.95 while depletion widens the
 * cover leftward. Null (unknown strength) is fully covered; out-of-range
 * percentages stay unclamped like the source. */
export function strengthCoverTransform(coverPercent: number | null): string {
  const scale = (coverPercent ?? 100) / 100;
  return (
    `translate(${layout.parentX + layout.strengthInstanceX} ${layout.openParentY + layout.strengthInstanceY}) ` +
    `scale(${scale} 1) translate(${layout.strengthChildX} ${layout.strengthChildY})`
  );
}

/** Owns/disposes an independent 13Hz view clock and retained closing ink.
 * Selection remains a host input; unavailable required art prevents painting.
 * The entire stage scales uniformly while only the exact SCAN region blocks
 * picking. SCAN has no command until its report mechanic is implemented. */
export function TacticalPresentation({
  model,
  available,
  framesPerSecond,
}: {
  readonly model: TacticalReadModel | null;
  readonly available: boolean;
  readonly framesPerSecond: number;
}) {
  const controller = useMemo(createTacticalController, []);
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const retained = useRef<TacticalReadModel | null>(null);
  // Display-only bookkeeping for mid-slide reversals (see below).
  const drawn = useRef<{ y: number; fraction: number; destinationY: number; parentY: number } | null>(null);
  const reversal = useRef<{ fromY: number; fromFraction: number; destinationY: number; parentY: number } | null>(
    null
  );
  useEffect(() => {
    if (model) retained.current = model;
    controller.select(model !== null);
  }, [model, controller]);
  // Exposure chooses the endpoint. The clock runs only while the panel moves.
  // Mid-slide reversals keep the existing authored interval.
  const destinationY = view.open ? layout.openParentY : layout.closedParentY;
  const animating = available && view.parentY !== destinationY;
  const fraction = usePresentationClock(animating, framesPerSecond, controller.advance, undefined, animating);
  const displayed = model ?? retained.current;
  if (!available || !displayed || (view.parentY === layout.closedParentY && !view.open)) return null;
  // The interpolated position moves the SVG group only. Closing ink remains
  // attached until the controller commits the closed position. A reversal
  // mid-interval continues from the position last drawn toward the next
  // authored position, rather than mirroring the interval fraction toward the
  // new endpoint (a jump of up to two steps). That segment ends at the next
  // authored commit, which it reaches exactly.
  const last = drawn.current;
  if (last && last.parentY === view.parentY && last.destinationY !== destinationY)
    reversal.current = { fromY: last.y, fromFraction: last.fraction, destinationY, parentY: view.parentY };
  const segment = reversal.current;
  reversal.current =
    segment &&
    segment.destinationY === destinationY &&
    segment.parentY === view.parentY &&
    fraction >= segment.fromFraction
      ? segment
      : null;
  const nextParentY = stepToward(view.parentY, destinationY, layout.pixelsPerFrame);
  const span = reversal.current ? 1 - reversal.current.fromFraction : 0;
  const displayedParentY = reversal.current
    ? reversal.current.fromY +
      (nextParentY - reversal.current.fromY) * (span > 0 ? (fraction - reversal.current.fromFraction) / span : 1)
    : displayedStep(view.parentY, destinationY, layout.pixelsPerFrame, fraction);
  drawn.current = { y: displayedParentY, fraction, destinationY, parentY: view.parentY };
  const scan = tacticalContent.scan;
  return (
    <svg
      className="bm1-hud-stage bm1-tactical-stage"
      width={layout.stageWidth}
      height={layout.stageHeight}
      viewBox={`0 0 ${layout.stageWidth} ${layout.stageHeight}`}
      aria-label="Selected target tactical window"
      data-target-id={model?.id ?? ''}
      data-target-parent-y={view.parentY}
    >
      <g transform={`translate(0 ${displayedParentY - layout.openParentY})`}>
        <image href={tacticalAsset(tacticalContent.background)} width={layout.stageWidth} height={layout.stageHeight} />
        <image href={tacticalAsset(displayed.asset)} width={layout.stageWidth} height={layout.stageHeight} />
        {/* Source `_xscale` scales the strengthbar instance about its own origin
          (not the parent's), so the black cover stays inside the bar and grows
          leftward from its fixed right end. The child registration is scaled
          with the geometry. The default100 cover conceals unknown strength. */}
        <g
          transform={strengthCoverTransform(displayed.coverPercent)}
          data-target-cover-percent={displayed.coverPercent ?? 'unknown'}
        >
          <path d={STRENGTH_COVER_PATH} fill="black" />
        </g>
        {displayed.disabled && (
          <image
            href={tacticalAsset(tacticalContent.disabled)}
            width={layout.stageWidth}
            height={layout.stageHeight}
            data-target-disabled="true"
          />
        )}
        <image
          href={tacticalAsset(tacticalContent.arrow)}
          width={layout.stageWidth}
          height={layout.stageHeight}
          transform={`rotate(${displayed.arrowDegrees} ${layout.arrowX} ${layout.arrowY})`}
          data-target-bearing={displayed.arrowDegrees}
        />
        <SourceControl
          control={{
            scriptOffset: 772,
            name: '',
            depth: 2,
            artwork: null,
            paths: [`M${scan.left},${scan.top} H${scan.right} V${scan.bottom} H${scan.left} Z`],
          }}
          label="Scan selected target"
          disabled
        />
      </g>
    </svg>
  );
}
