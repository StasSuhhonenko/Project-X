/** UI-10 sits below playerpanel, above the world. Only the authored SCAN Hit
 * consumes pointer events; transparent stage pixels remain spatial pickable. */
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { SourceControl } from '../source-control';
import { usePresentationClock } from '../use-presentation-clock';
import { tacticalAsset, tacticalContent } from './tactical-content';
import { createTacticalController } from './tactical-controller';
import { TACTICAL_LAYOUT as layout } from './tactical-layout';
import type { TacticalReadModel } from './tactical-read-model';

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
  useEffect(() => {
    if (model) retained.current = model;
    controller.select(model !== null);
  }, [model, controller]);
  // Exposure records the intended endpoint, not ongoing work. Stop the clock
  // at either endpoint; changing selection restarts it for closing or reversal.
  const destinationY = view.open ? layout.openParentY : layout.closedParentY;
  usePresentationClock(available && view.parentY !== destinationY, framesPerSecond, controller.advance);
  const displayed = model ?? retained.current;
  if (!available || !displayed || (view.parentY === layout.closedParentY && !view.open)) return null;
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
      <g transform={`translate(0 ${view.parentY - layout.openParentY})`}>
        <image href={tacticalAsset(tacticalContent.background)} width={layout.stageWidth} height={layout.stageHeight} />
        <image href={tacticalAsset(displayed.asset)} width={layout.stageWidth} height={layout.stageHeight} />
        {/* Scale both child geometry and its registration before parent placement.
          The default100 cover explicitly conceals unknown station strength. */}
        <g
          transform={`translate(${layout.parentX} ${layout.openParentY}) scale(${(displayed.coverPercent ?? 100) / 100} 1) translate(${layout.strengthRegistrationX} 0)`}
          data-target-cover-percent={displayed.coverPercent ?? 'unknown'}
        >
          <path d="M-85.6,-18.75 L-35.6,-18.75 L-35.6,-5.65 L-85.6,-5.65 Z" fill="black" />
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
