/** Authenticated Font2 ink in the authored logical content rectangle. This
 * focused renderer supports uniform left/center-aligned dynamic receivers.
 * Missing codepoints fail explicitly; no platform text paints in the stage.
 * Arial is the existing HUD default; arrival passes its exact Times face.
 * Metrics are in font em units, positions/advances in 1/20-pixel Flash twips. */
import { useId } from 'react';
import { hudContent, type GlyphFont, type HudField } from './hud-content';

const fonts = new WeakMap<GlyphFont, ReadonlyMap<number, GlyphFont['glyphs'][number]>>();
const twips = (value: number) => Math.trunc(value * 20) / 20;

/** Lays out a uniform dynamic source field without DOM measurements.
 * Returns glyph ink in logical pixels relative to the receiver origin. The
 * caller owns clipping to the source rectangle. Unsupported codepoints throw
 * so no browser font can silently replace missing authenticated artwork. */
export function layoutHudText(field: HudField, input: string, font: GlyphFont = hudContent.font) {
  const scale = field.size / font.em;
  let glyphs = fonts.get(font);
  if (!glyphs) {
    glyphs = new Map(font.glyphs.map(glyph => [glyph.code, glyph]));
    fonts.set(font, glyphs);
  }
  const glyphFor = (character: string) => {
    const glyph = glyphs!.get(character.codePointAt(0)!);
    if (!glyph) throw new Error(`HUD glyph unavailable: U+${character.codePointAt(0)!.toString(16).toUpperCase()}`);
    return glyph;
  };
  const advance = (character: string) =>
    character === '\t' ? field.size * 2.7 : twips(glyphFor(character).advance * scale + field.letterSpacing);
  const measure = (text: string) => [...text].reduce((total, character) => total + advance(character), 0);
  const lines: { text: string; left: number }[] = [];
  input
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .forEach(paragraph => {
      let text = '';
      let first = true;
      // Sequential token consumption preserves authored paragraph/wrap ordering.
      (paragraph.match(/\S+|\s+/g) ?? ['']).forEach(token => {
        const left = Math.max(0, field.leftMargin + (first ? field.indent : 0));
        if (
          field.wrap &&
          text &&
          !/^\s+$/.test(token) &&
          measure(text + token) > field.width - left - field.rightMargin
        ) {
          lines.push({ text, left });
          text = '';
          first = false;
        }
        text += token;
      });
      lines.push({ text, left: Math.max(0, field.leftMargin + (first ? field.indent : 0)) });
    });
  const ascent = twips(font.ascent * scale);
  const step = ascent + twips(font.descent * scale) + field.lineSpacing;
  return lines.flatMap((line, row) => {
    let x = line.left;
    if (field.alignment === 'center')
      x = line.left + (field.width - line.left - field.rightMargin - measure(line.text)) / 2;
    if (field.alignment === 'right') x = field.width - field.rightMargin - measure(line.text);
    return [...line.text].flatMap(character => {
      const at = x;
      x += advance(character);
      if (character === '\t') return [];
      return [{ path: glyphFor(character).path, x: at, y: ascent + row * step, scale }];
    });
  });
}

/** Paints source glyph paths inside a unique, per-instance field clip. Input
 * text remains exposed as accessible text while ink uses only recovered paths.
 * Throws on unsupported glyphs; callers must preflight at their error boundary. */
export function HudGlyphField({
  field,
  text,
  font,
}: {
  readonly field: HudField;
  readonly text: string;
  readonly font?: GlyphFont;
}) {
  const clip = useId();
  const paths = layoutHudText(field, text, font);
  return (
    <g
      transform={`translate(${field.x} ${field.y})`}
      data-hud-field={field.variable}
      data-hud-text={text}
      role="img"
      aria-label={text}
    >
      <defs>
        <clipPath id={clip}>
          <rect width={field.width} height={field.height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`} fill={`rgb(${field.rgba.slice(0, 3).join(',')})`} fillOpacity={field.rgba[3] / 255}>
        {paths.map((glyph, index) => (
          <path key={index} d={glyph.path} transform={`translate(${glyph.x} ${glyph.y}) scale(${glyph.scale})`} />
        ))}
      </g>
    </g>
  );
}
