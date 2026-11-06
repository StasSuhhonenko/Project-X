/** Maintained viewport ink and compiled tween boundary. Recovery files are
 * never imported by runtime; these validated module assets are authoritative. */
import { z } from 'zod';
import { GlyphFontSchema, HudFieldSchema } from '../hud/hud-content';
import { runtimeAssetUrl } from '../runtime-assets';
import raw from '../viewport-data.json';

const finite = z.number().finite();
const matrix = z.object({ a: finite, b: finite, c: finite, d: finite, tx: finite, ty: finite }).strict().readonly();
const asset = z.string().regex(/^viewport-[a-z0-9-]+\.svg$/);
export const ViewportContentSchema = z
  .object({
    sun: z
      .object({
        file: asset,
        x: finite,
        y: finite,
        width: finite.positive(),
        height: finite.positive(),
        parallax: finite.nonnegative(),
      })
      .strict()
      .readonly(),
    arrivalStarPath: z.string().regex(/^[MLQZ0-9e., +\-]*$/),
    arrivalStars: z
      .array(
        z
          .object({
            offset: z.number().int().positive(),
            x: finite,
            y: finite,
            scaleX: finite.positive(),
            scaleY: finite.positive(),
            speedPerFrame: z.union([z.literal(5), z.literal(10), z.literal(20)]),
            wrap: z.boolean(),
          })
          .strict()
          .readonly()
      )
      .length(21)
      .readonly(),
    backgrounds: z
      .array(
        z
          .object({
            frame: z.number().int(),
            file: asset,
            sourceFile: z.string(),
            sha256: z.string().length(64),
          })
          .strict()
          .readonly()
      )
      .length(4)
      .readonly(),
    weapons: z
      .array(z.object({ id: z.number().int().positive(), file: asset }).strict().readonly())
      .length(19)
      .readonly(),
    fields: z
      .array(z.object({ transform: matrix, field: HudFieldSchema }).strict().readonly())
      .length(3)
      .readonly(),
    font: GlyphFontSchema,
    warp: z
      .array(
        z
          .object({
            frame: z.number().int(),
            kind: z.enum(['ship', 'flash']),
            matrix,
            alpha: finite.min(0).max(1),
          })
          .strict()
          .readonly()
      )
      .length(18)
      .readonly(),
  })
  .strict()
  .superRefine((data, context) => {
    if (
      data.warp.some(
        (sample, index) => sample.frame !== index + 3 || sample.kind !== (sample.frame <= 10 ? 'ship' : 'flash')
      )
    )
      context.addIssue({ code: 'custom', message: 'Exact departure frames3..20 and ship/flash boundary required' });
    if (data.backgrounds.some((background, index) => background.frame !== index + 2))
      context.addIssue({ code: 'custom', message: 'Background frames2..5 required' });
  })
  .readonly();
export const viewportContent = ViewportContentSchema.parse(raw);
export const viewportAsset = (file: string) => runtimeAssetUrl(`assets/viewport/${file}`);
export const viewportAssets = Object.freeze([
  'viewport-top.svg',
  'viewport-minimap.svg',
  'viewport-arrival-panel.svg',
  viewportContent.sun.file,
  ...viewportContent.backgrounds.map(background => background.file),
  ...viewportContent.weapons.map(weapon => weapon.file),
]);

/** Symbol285 selects artwork by system range; the backdrop is screen-fixed.
 * Motion parallax remains the separate star instances owned by the host view. */
export function backgroundFile(systemId: number) {
  if (systemId < 20) return viewportContent.backgrounds[0]!.file;
  if (systemId < 40) return viewportContent.backgrounds[1]!.file;
  if (systemId < 50) return viewportContent.backgrounds[2]!.file;
  return viewportContent.backgrounds[3]!.file;
}
