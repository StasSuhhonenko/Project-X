/** Reviewed HUD content boundary. Local geometry is normalized to parent
 * (300,282); source y is never inferred from the bitmap's visible rectangle. */
import { z } from 'zod';
import sourceActions from '../hud-actions.json';
import raw from '../hud-data.json';
import { runtimeAssetUrl } from '../runtime-assets';

const finite = z.number().finite();
const path = z.string().regex(/^[MLQZ0-9e., +\-]*$/);
/** Authenticated embedded font contract shared by maintained module receivers. */
export const GlyphFontSchema = z
  .object({
    em: finite.positive(),
    ascent: finite,
    descent: finite,
    glyphs: z
      .array(z.object({ code: z.number().int().nonnegative(), path, advance: finite }).strict().readonly())
      .readonly(),
  })
  .strict()
  .readonly();
export type GlyphFont = z.infer<typeof GlyphFontSchema>;
/** Reviewed presentation intents; unavailable source mechanics have no action. */
export const HudActionSchema = z.enum([
  'load-slot-1',
  'load-slot-2',
  'load-slot-3',
  'rollover',
  'map',
  'cargo',
  'statistics',
  'power',
  'fleet',
  'close-cargo',
  'close-statistics',
  'close-power',
  'unavailable',
]);
/** Uniform embedded Font2 receiver shared by HUD and contact glyph painting. */
export const HudFieldSchema = z
  .object({
    offset: z.number().int(),
    variable: z.string(),
    x: finite,
    y: finite,
    width: finite.positive(),
    height: finite.positive(),
    wrap: z.boolean(),
    alignment: z.enum(['left', 'center', 'right']).optional(),
    size: finite.positive(),
    rgba: z.tuple([finite, finite, finite, finite]).readonly(),
    lineSpacing: finite,
    leftMargin: finite,
    rightMargin: finite,
    indent: finite,
    letterSpacing: finite,
  })
  .strict()
  .readonly();
const ControlSchema = z
  .object({
    offset: z.number().int(),
    action: HudActionSchema,
    label: z.string(),
    hint: z.string(),
    left: finite,
    top: finite,
    right: finite,
    bottom: finite,
    layer: z.number().int(),
  })
  .strict()
  .readonly();
const actionBindings = z
  .record(
    z.string(),
    z
      .object({
        action: HudActionSchema,
        label: z.string(),
      })
      .strict()
      .readonly()
  )
  .readonly()
  .parse(sourceActions);

/** Validates maintained source planes at import, before a gameplay mount.
 * Exact plane/asset/action ownership supplements structural/geometry checks.
 * Every nested record/collection is frozen by its owning readonly schema. */
export const HudContentSchema = z
  .object({
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    planes: z
      .array(
        z
          .object({
            id: z.enum(['UI-09', 'UI-11', 'UI-12', 'UI-13', 'UI-14']),
            asset: z.string().regex(/^hud-UI-\d+\.svg$/),
            fields: z.array(HudFieldSchema).readonly(),
            controls: z.array(ControlSchema).readonly(),
            masks: z
              .array(
                z
                  .object({
                    name: z.string(),
                    offset: z.number().int(),
                    matrix: z.tuple([finite, finite, finite, finite, finite, finite]).readonly(),
                    path,
                  })
                  .strict()
                  .readonly()
              )
              .readonly(),
          })
          .strict()
          .readonly()
      )
      .length(5)
      .readonly(),
    font: GlyphFontSchema,
  })
  .strict()
  .superRefine((content, context) => {
    const reject = (message: string) => context.addIssue({ code: 'custom', message });
    if (new Set(content.planes.map(p => p.id)).size !== 5) reject('Required HUD planes must have distinct owners');
    if (new Set(content.font.glyphs.map(g => g.code)).size !== content.font.glyphs.length)
      reject('Duplicate HUD glyph code');
    content.planes.forEach(p => {
      if (p.asset !== `hud-${p.id}.svg`) reject('HUD asset must match its source plane owner');
      if (new Set(p.controls.map(c => c.offset)).size !== p.controls.length) reject('Duplicate HUD control');
      if (!p.controls.some(c => c.action === 'rollover' && c.offset === 67))
        reject('HUD plane must retain original rollover owner');
      if (!p.controls.every(c => c.right > c.left && c.bottom > c.top)) reject('Invalid HUD Hit extent');
      if (!p.controls.every(c => c.action === (actionBindings[c.offset]?.action ?? 'unavailable')))
        reject('HUD control must retain its exact source action binding');
      const needed =
        p.id === 'UI-09'
          ? ['load-slot-1', 'load-slot-2', 'load-slot-3', 'rollover', 'map', 'cargo', 'statistics', 'power', 'fleet']
          : p.id === 'UI-14'
            ? ['rollover']
            : [
                'rollover',
                'cargo',
                'statistics',
                'power',
                'fleet',
                p.id === 'UI-11' ? 'close-cargo' : p.id === 'UI-12' ? 'close-statistics' : 'close-power',
              ];
      if (!needed.every(action => p.controls.some(c => c.action === action)))
        reject('HUD plane is missing a required source navigation command');
      if (
        new Set(p.fields.map(f => f.offset)).size !== p.fields.length ||
        new Set(p.fields.map(f => f.variable)).size !== p.fields.length
      )
        reject('HUD field receivers must be distinct');
      if (
        new Set(p.masks.map(m => m.offset)).size !== p.masks.length ||
        new Set(p.masks.map(m => m.name)).size !== p.masks.length
      )
        reject('HUD mask owners must be distinct');
    });
  })
  .readonly();
/** Immutable, validated maintained source content. Invalid input blocks startup. */
export const hudContent = HudContentSchema.parse(raw);
/** Source dynamic receiver geometry and uniform text metrics, in logical pixels. */
export type HudField = z.infer<typeof HudFieldSchema>;
/** Authored-Up fallback Hit rectangle and reviewed presentation intent. */
export type HudControl = z.infer<typeof ControlSchema>;
/** Named local navigation intent inferred from the authoritative schema. */
export type HudAction = z.infer<typeof HudActionSchema>;
/** Resolves a schema-validated selected-module HUD filename at the staging path. */
export const hudAsset = (file: string) => runtimeAssetUrl(`assets/hud/${file}`);
