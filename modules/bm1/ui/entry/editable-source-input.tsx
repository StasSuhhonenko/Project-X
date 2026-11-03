/** Browser editing adaptation: native single-line input owns keyboard, clipboard,
 * composition, caret and selection; authenticated Arial paths own visible ink.
 * Native caret/selection metrics can differ from Flash glyph-path metrics. */
import { useState } from 'react';
import { hudContent, type HudField } from '../hud/hud-content';
import { HudGlyphField } from '../hud/hud-glyphs';

const codes = new Set(hudContent.font.glyphs.map(glyph => glyph.code));
/** Missing embedded characters are retained, never replaced or silently dropped. */
export const hasUnsupportedSourceGlyph = (text: string) => [...text].some(character => !['\n', '\r', '\t'].includes(character) && !codes.has(character.codePointAt(0)!));

/** HUD fallback for exact names outside the recovered font. Parent presentation
 * discloses this browser-text adaptation visibly; input/save values stay exact. */
export function SourceIdentityText({ field, text }: { readonly field: HudField; readonly text: string }) {
  if (!hasUnsupportedSourceGlyph(text)) return <HudGlyphField field={field} text={text} />;
  return <svg x={field.x} y={field.y} width={field.width} height={field.height} viewBox={`0 0 ${field.width} ${field.height}`}
    data-hud-field={field.variable} data-hud-text={text} role="img" aria-label={text}>
    <text x="0" y={Math.trunc(hudContent.font.ascent * field.size / hudContent.font.em * 20) / 20} fontFamily="Arial, sans-serif" fontSize={field.size} fill={`rgb(${field.rgba.slice(0, 3).join(',')})`}>{text}</text>
  </svg>;
}

/** The fallback is deliberate and visibly disclosed outside the source stage.
 * Supported text always paints embedded glyphs, including while composing. */
export function EditableSourceInput({ field, value, label, onChange }: {
  readonly field: HudField; readonly value: string; readonly label: string; readonly onChange: (value: string) => void;
}) {
  const [scrollLeft, setScrollLeft] = useState(0);
  const fallback = hasUnsupportedSourceGlyph(value);
  return <>
    {!fallback && <svg className="bm1-editable-glyphs" x={field.x} y={field.y} width={field.width} height={field.height} viewBox={`0 0 ${field.width} ${field.height}`} aria-hidden="true">
      <HudGlyphField field={{ ...field, x: -scrollLeft, y: 0 }} text={value} />
    </svg>}
    <foreignObject x={field.x} y={field.y} width={field.width} height={field.height}>
      <input className={`bm1-source-input${fallback ? ' bm1-source-input-fallback' : ''}`} aria-label={label}
        data-source-input={field.offset} data-game-input="blocked" type="text" value={value} spellCheck={false}
        autoComplete="off" style={{ fontSize: field.size, height: field.height, lineHeight: `${field.size + field.lineSpacing}px` }}
        onChange={event => onChange(event.currentTarget.value)} onScroll={event => setScrollLeft(event.currentTarget.scrollLeft)}
        onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}
        onCompositionStart={event => event.stopPropagation()} onCompositionUpdate={event => event.stopPropagation()} onCompositionEnd={event => event.stopPropagation()} />
    </foreignObject>
  </>;
}
