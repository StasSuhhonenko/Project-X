/** Source UI-16/UI-29 event attachment: original ink/glyphs, growth and Close/Q.
 * The parent owns observation/replacement while art loads; this view owns only
 * mounted DOM focus/listeners/clock. Host intent owns cosmetic audio lifetime. */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { ComponentProps } from 'react';
import { createPortal } from 'react-dom';
import { eventHasUiInputOwner } from '@engine/platform/keyboard/ui-input-ownership';
import { CONTACT_LAYOUT as layout } from '../contact/contact-layout';
import { HudGlyphField } from '../hud/hud-glyphs';
import { SourceControl } from '../source-control';
import { usePresentationClock } from '../use-presentation-clock';
import { communicationAsset, communicationContent as content } from './communication-content';
import type { CommunicationController } from './communication-controller';

export const communicationPresentationAssets = (_props: ComponentProps<typeof CommunicationPresentation>) => [
  communicationAsset(content.asset),
];

export function CommunicationPresentation({
  controller,
  available,
  overlay,
  framesPerSecond,
  onPlayCue,
}: {
  readonly controller: CommunicationController;
  readonly available: boolean;
  readonly overlay: HTMLElement | null;
  readonly framesPerSecond: number;
  readonly onPlayCue: (sequence: number) => void;
}) {
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const panel = useRef<SVGSVGElement>(null);
  const returnFocus = useRef<HTMLElement | SVGElement | null>(null);
  const played = useRef(0);
  const report = view.report;
  usePresentationClock(
    Boolean(report && available && overlay && view.scale < layout.maximumScale),
    framesPerSecond,
    controller.advance,
    report?.sequence
  );
  useEffect(() => {
    if (!report || !available || !overlay) return;
    const focused = document.activeElement;
    if (focused instanceof HTMLElement || focused instanceof SVGElement) returnFocus.current = focused;
    panel.current?.querySelector<SVGGElement>('[role="button"]')?.focus();
    if (played.current !== report.sequence) {
      played.current = report.sequence;
      onPlayCue(report.sequence);
    }
    const down = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.key.toLowerCase() !== 'q')
        return;
      const ownControl = event.target instanceof Element && panel.current?.contains(event.target);
      if (eventHasUiInputOwner(event) && !ownControl) return;
      event.preventDefault();
      controller.close();
    };
    window.addEventListener('keydown', down);
    return () => {
      window.removeEventListener('keydown', down);
      // Replaced contacts are disconnected. Return to the stable stage rather
      // than focusing their former browser opener under the next attachment.
      const target = returnFocus.current;
      if (target?.isConnected && !target.closest('[data-contact-kind], [data-communication-sequence]')) target.focus();
      else (overlay.closest('.bm1-game-stage') as HTMLElement | null)?.focus();
    };
  }, [report?.sequence, available, overlay, controller, framesPerSecond, onPlayCue]);
  if (!report || !available || !overlay) return null;
  return createPortal(
    <svg
      ref={panel}
      className="bm1-hud-stage bm1-contact-stage"
      width={layout.stageWidth}
      height={layout.stageHeight}
      viewBox={`0 0 ${layout.stageWidth} ${layout.stageHeight}`}
      aria-label="Fleet communication"
      data-communication-sequence={report.sequence}
      data-communication-scale={view.scale}
    >
      <g
        transform={`translate(${layout.parentX} ${layout.parentY}) scale(${view.scale / layout.maximumScale}) translate(${-layout.parentX} ${-layout.parentY})`}
      >
        {content.controls
          .filter(c => c.layer === 1)
          .map(c => (
            <rect
              key={c.offset}
              x={c.left}
              y={c.top}
              width={c.right - c.left}
              height={c.bottom - c.top}
              fill="transparent"
              className="bm1-contact-blocker"
            />
          ))}
        <image href={communicationAsset(content.asset)} width={layout.stageWidth} height={layout.stageHeight} />
        <HudGlyphField field={content.field} text={report.message} />
        {content.controls
          .filter(c => c.layer !== 1)
          .map(c => (
            <SourceControl
              key={c.offset}
              control={{
                scriptOffset: c.offset + 88,
                name: '',
                depth: c.layer,
                artwork: null,
                paths: [`M${c.left},${c.top} H${c.right} V${c.bottom} H${c.left} Z`],
              }}
              label="Close fleet communication"
              onActivate={controller.close}
            />
          ))}
      </g>
    </svg>,
    overlay
  );
}
