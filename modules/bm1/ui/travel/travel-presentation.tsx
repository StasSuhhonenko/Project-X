/** Original UI-21 actor/arrival presentation. All completion, readiness and
 * rollback decisions remain host-owned; this clock only chooses source ink. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GameplayPresentationProps } from '../../presentation-contract';
import { HudGlyphField, layoutHudText } from '../hud/hud-glyphs';
import { playerActorScale } from '../player-actor-scale';
import { playerHull, PlayerHullImage } from '../player-hull-art';
import { SourceControl } from '../source-control';
import { viewportAsset, viewportContent } from '../viewport/viewport-content';
import { createArrivalStarHistory } from './arrival-star-history';
import { travelAsset, travelContent } from './travel-content';
import { departureTween, travelReport } from './travel-read-model';

type TravelProps = Pick<GameplayPresentationProps, 'travel' | 'routePhase' | 'onDismissTravel'> & {
  readonly available: boolean;
  readonly overlay: HTMLElement | null;
};
/** Owns/disposes its display clock and focus. A summary can only ask the guarded
 * host intent to dismiss; unmount and failed artwork never acknowledge arrival. */
export function TravelPresentation({ travel, routePhase, onDismissTravel, available, overlay }: TravelProps) {
  const [now, setNow] = useState(() => performance.now());
  const stage = useRef<SVGSVGElement>(null);
  const hadSummary = useRef(false);
  const summary = travel !== null && routePhase === 'ready';
  const stars = useMemo(createArrivalStarHistory, [travel?.operationId]);
  const [starTime, setStarTime] = useState(0);
  useEffect(() => {
    if (!travel || !available) return;
    setNow(performance.now());
    setStarTime(0);
    let frame = 0;
    let previous: number | undefined,
      elapsed = 0;
    const rebase = () => {
      previous = undefined;
    };
    const draw = (time: number) => {
      setNow(time);
      if (summary && document.visibilityState === 'visible' && document.hasFocus()) {
        if (previous !== undefined) elapsed += Math.max(0, Math.min(250, time - previous));
        setStarTime(elapsed);
      }
      previous = time;
      frame = window.requestAnimationFrame(draw);
    };
    window.addEventListener('blur', rebase);
    window.addEventListener('focus', rebase);
    document.addEventListener('visibilitychange', rebase);
    frame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('blur', rebase);
      window.removeEventListener('focus', rebase);
      document.removeEventListener('visibilitychange', rebase);
    };
  }, [travel?.operationId, summary, available]);
  useEffect(() => {
    if (summary && available) stage.current?.querySelector<SVGGElement>('[role="button"]')?.focus();
    if (!summary && hadSummary.current && !travel) overlay?.closest<HTMLElement>('.bm1-game-stage')?.focus();
    hadSummary.current = summary;
  }, [summary, available, travel?.operationId, overlay]);
  if (!travel || !available || !overlay) return null;
  const text = travelReport(travel);
  // Preflight authentic glyph coverage before mounting the receiver. HUD's
  // error boundary retains browser recovery when a module data contract fails.
  layoutHudText(travelContent.field, text, travelContent.font);
  const pose = departureTween(now - travel.departureStartedAtMs);
  // Every flight-capable hull has a registration (tested invariant); the guard
  // remains a fail-closed backstop for an unregistered module definition.
  const ship = playerHull(travel.playerDefinitionId);
  if (pose?.kind === 'ship' && !ship) throw new Error('Departure ship selector artwork is unavailable.');
  // Flash ink15 already contains its authored transform. Remove that base before
  // applying the current sample, preserving its registration without double scale.
  const base = viewportContent.warp[12]!.matrix;
  const m = pose?.matrix;
  const actorTransform =
    m && pose.kind === 'flash'
      ? `matrix(${m.a / base.a} 0 0 ${m.d / base.d} ${m.tx - (m.a / base.a) * base.tx} ${m.ty - (m.d / base.d) * base.ty})`
      : m
        ? `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.tx} ${m.ty})`
        : '';
  const b = travelContent.continueBounds;
  const spatial = travel.originSpatial;
  if (!spatial) throw new Error('BM1 actor overlay projection is unavailable.');
  return createPortal(
    <svg
      ref={stage}
      className="bm1-hud-stage bm1-travel-stage"
      width="600"
      height="450"
      viewBox="0 0 600 450"
      role="group"
      aria-label={summary ? 'Travel arrival summary' : 'Departing system'}
      data-travel-operation={travel.operationId}
      data-travel-state={summary ? 'summary' : routePhase}
      data-travel-frame={pose?.frame ?? 'removed'}
      data-travel-pose={pose?.kind ?? 'removed'}
    >
      {/* Only the summary owns a black scene. Departure preserves the existing
       * host world; the neutral host option hides its ordinary player sprite. */}
      <rect width="600" height="450" fill={summary ? 'black' : 'transparent'} className="bm1-travel-blocker" />
      {summary && (
        <>
          <g data-arrival-stars-time={starTime} aria-label="Warping stars">
            {stars.sample(starTime).map((star, index) => {
              const authored = viewportContent.arrivalStars[index]!;
              return (
                <path
                  key={authored.offset}
                  d={viewportContent.arrivalStarPath}
                  fill="white"
                  transform={`translate(${star.x} ${star.y}) scale(${authored.scaleX} ${authored.scaleY})`}
                />
              );
            })}
          </g>
          <image href={viewportAsset('viewport-arrival-panel.svg')} width="600" height="450" />
          <HudGlyphField field={travelContent.field} text={text} font={travelContent.font} />
          <SourceControl
            control={{
              scriptOffset: 24289,
              name: '',
              depth: 6,
              artwork: null,
              paths: [`M${b.left},${b.top} H${b.right} V${b.bottom} H${b.left} Z`],
            }}
            label="Continue after arrival"
            onActivate={onDismissTravel}
          />
        </>
      )}
      {!summary && pose && (
        <g
          transform={`translate(${spatial.x} ${spatial.y}) rotate(${spatial.headingDegrees}) scale(${playerActorScale(ship?.playerScale, spatial.zoom)})`}
        >
          <g transform={actorTransform} opacity={pose.alpha} data-warp-transform={actorTransform}>
            {pose.kind === 'ship' ? (
              // Frame3 composition: the hull child under the recorded Symbol2
              // parent, re-registered to the actor origin like the flash pose.
              <g transform="translate(-300 -225)">
                <PlayerHullImage hull={ship!} parent={travelContent.shipPose.parent} />
              </g>
            ) : (
              <image href={travelAsset('travel-departure-15.svg')} x="-300" y="-225" width="600" height="450" />
            )}
          </g>
        </g>
      )}
    </svg>,
    overlay
  );
}
