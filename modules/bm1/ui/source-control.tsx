/** Semantic source Hit contours. Ink is an independently selected authored
 * bitmap plane; focus never changes geometry. Pointer ordering follows reviewed
 * source depth, including rectangular corners outside the painted ovals. */
import { useRef, useState } from 'react';
import type { EntryControl } from './entry/entry-content';
import { entryAsset } from './entry/entry-content';

export function SourceControl({
  control,
  label,
  onActivate,
  disabled = false,
}: {
  readonly control: EntryControl;
  readonly label: string;
  readonly onActivate?: (release: { readonly shiftKey: boolean }) => void;
  readonly disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  // An Enter/Space release belongs only to the control that accepted its down event.
  // Blur/cancel disarms it, so a focus move while held cannot activate a peer.
  const armedKey = useRef<string | null>(null);
  const state = pressed ? 'down' : hovered || focused ? 'over' : 'up';
  return (
    <g
      role="button"
      aria-label={label}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      data-source-control={control.scriptOffset}
      className={`bm1-source-control${focused ? ' bm1-source-focused' : ''}`}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onPointerDown={event => {
        if (!disabled && event.button === 0) setPressed(true);
      }}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => {
        armedKey.current = null;
        setPressed(false);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        armedKey.current = null;
        setFocused(false);
        setPressed(false);
      }}
      onClick={event => {
        if (!disabled) onActivate?.({ shiftKey: event.shiftKey });
      }}
      onKeyDown={event => {
        if (disabled || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        if (event.repeat) return;
        setPressed(true);
        armedKey.current = event.key;
      }}
      onKeyUp={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setPressed(false);
        const activate = !disabled && armedKey.current === event.key;
        armedKey.current = null;
        if (activate) onActivate?.({ shiftKey: event.shiftKey });
      }}
    >
      <title>
        {label}
        {disabled ? ' — unavailable in this build' : ''}
      </title>
      {control.artwork && (
        <image href={entryAsset(control.artwork[state])} width="600" height="450" className="bm1-source-ink" />
      )}
      {control.paths.map((path, index) => (
        <path key={index} d={path} className="bm1-source-hit" />
      ))}
    </g>
  );
}
