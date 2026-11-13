/** Type27 paints the Up bitmap button, its authored black/#990000 backing box,
 * then the input field, in compiled depth order; it has no Q listener or Close.
 * D8/D9 intentionally give the browser field input ownership and initial focus.
 * Native caret/selection/scrolling differ from Flash; supported visible ink uses
 * the same recovered Arial336 paths as other Symbol3 fields. */
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { TextCommandIntent } from '@engine/simulation/contracts/text-command';
import { CONTACT_LAYOUT as layout } from '../contact/contact-layout';
import { hasUnsupportedSourceGlyph } from '../entry/editable-source-input';
import { HudGlyphField } from '../hud/hud-glyphs';
import { SourceControl } from '../source-control';
import { usePresentationClock } from '../use-presentation-clock';
import { cheatAsset, cheatContent as content } from './cheat-content';
import type { CheatController } from './cheat-controller';
import './cheat.css';

export const cheatPresentationAssets = () => [cheatAsset()];
/** Exported ink permits static contract tests without a browser portal. */
export function CheatArtwork({
  controller,
  inputRef,
  onSubmit,
}: {
  readonly controller: CheatController;
  readonly inputRef?: RefObject<HTMLTextAreaElement | null>;
  readonly onSubmit?: ((intent: TextCommandIntent) => boolean) | undefined;
}) {
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [scrollTop, setScrollTop] = useState(0);
  const field = content.field;
  const c = content.control;
  const box = content.box;
  const rgb = ([r, g, b]: readonly number[]) => `rgb(${r} ${g} ${b})`;
  const fallback = hasUnsupportedSourceGlyph(view.text);
  return (
    <svg
      className="bm1-hud-stage bm1-contact-stage"
      width={layout.stageWidth}
      height={layout.stageHeight}
      viewBox={`0 0 ${layout.stageWidth} ${layout.stageHeight}`}
      aria-label="Cheat console"
      data-cheat-scale={view.scale}
    >
      {/* loadcomm's shared UI-16 parent (303,110); scale is source percent. */}
      <g
        transform={`translate(${layout.parentX} ${layout.parentY}) scale(${view.scale / 100}) translate(${-layout.parentX} ${-layout.parentY})`}
      >
        {/* Compiled depth order: button art (1), backing box (3), field (4). The
         * button's hit control is appended last; it does not overlap the box. */}
        <image href={cheatAsset()} x={c.left} y={c.top} width={c.right - c.left} height={c.bottom - c.top} />
        <rect
          className="bm1-cheat-box"
          data-source-shape={box.offset}
          x={box.left}
          y={box.top}
          width={box.right - box.left}
          height={box.bottom - box.top}
          fill={rgb(box.fill)}
          stroke={rgb(box.stroke)}
          strokeWidth={box.strokeWidth}
        />
        {!fallback && (
          <svg
            x={field.x}
            y={field.y}
            width={field.width}
            height={field.height}
            viewBox={`0 0 ${field.width} ${field.height}`}
            className="bm1-editable-glyphs"
            aria-hidden="true"
          >
            <HudGlyphField field={{ ...field, x: 0, y: -scrollTop }} text={view.text} />
          </svg>
        )}
        <foreignObject x={field.x} y={field.y} width={field.width} height={field.height}>
          <textarea
            ref={inputRef}
            className={`bm1-cheat-input${fallback ? ' bm1-cheat-input-fallback' : ''}`}
            aria-label="Cheat text"
            data-game-input="blocked"
            data-source-input={field.offset}
            value={view.text}
            wrap="soft"
            spellCheck={false}
            autoComplete="off"
            onChange={event => controller.setText(event.currentTarget.value)}
            onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
            onKeyDown={event => event.stopPropagation()}
            onKeyUp={event => event.stopPropagation()}
            onCompositionStart={event => event.stopPropagation()}
            onCompositionEnd={event => event.stopPropagation()}
          />
        </foreignObject>
        <SourceControl
          control={{
            scriptOffset: 3520,
            name: '',
            depth: 1,
            artwork: null,
            paths: [`M${c.left},${c.top} H${c.right} V${c.bottom} H${c.left} Z`],
          }}
          label="Submit cheat text"
          onActivate={() => controller.submit(onSubmit)}
        />
      </g>
    </svg>
  );
}

export function CheatPresentation({
  controller,
  available,
  overlay,
  framesPerSecond,
  onSubmit,
  onPlayCue,
}: {
  readonly controller: CheatController;
  readonly available: boolean;
  readonly overlay: HTMLElement | null;
  readonly framesPerSecond: number;
  readonly onSubmit?: ((intent: TextCommandIntent) => boolean) | undefined;
  readonly onPlayCue: (sequence: number) => void;
}) {
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const input = useRef<HTMLTextAreaElement>(null);
  const played = useRef(0);
  usePresentationClock(
    view.open && available && Boolean(overlay) && view.scale < 100,
    framesPerSecond,
    controller.advance,
    view.revision
  );
  useEffect(() => {
    if (!view.open || !available || !overlay) return;
    input.current?.focus();
    if (played.current !== view.revision) {
      played.current = view.revision;
      onPlayCue(view.revision);
    }
    return () => {
      overlay.closest<HTMLElement>('.bm1-game-stage')?.focus();
    };
  }, [view.open, view.revision, available, overlay, onPlayCue]);
  if (!view.open || !available || !overlay) return null;
  return createPortal(<CheatArtwork controller={controller} inputRef={input} onSubmit={onSubmit} />, overlay);
}
