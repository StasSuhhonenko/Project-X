/** Validated maintained recovery derivatives; no runtime recovery dependency. */
import { z } from 'zod';
import raw from '../construction-data.json';
import { HudFieldSchema } from '../hud/hud-content';
import { runtimeAssetUrl } from '../runtime-assets';

const finite = z.number().finite();
const BoundsSchema = z.object({ left: finite, top: finite, right: finite, bottom: finite }).strict().readonly();
export const ConstructionContentSchema = z
  .object({
    fields: z
      .array(z.object({ text: z.string(), field: HudFieldSchema }).strict().readonly())
      .length(7)
      .readonly(),
    controls: z
      .array(BoundsSchema.unwrap().extend({ offset: z.number().int() }).strict().readonly())
      .length(4)
      .readonly(),
    icons: z
      .array(
        z
          .object({
            id: z.number().int().min(70).max(100),
            file: z.string().regex(/^plan-(?:[7-9][0-9]|100)\.svg$/),
            hitBounds: BoundsSchema,
          })
          .strict()
          .readonly()
      )
      .length(31)
      .readonly(),
    previewMatrix: z.object({ a: finite, b: finite, c: finite, d: finite, tx: finite, ty: finite }).strict().readonly(),
  })
  .strict()
  .superRefine((content, context) => {
    if (content.icons.some((icon, index) => icon.id !== index + 70 || icon.file !== 'plan-' + icon.id + '.svg'))
      context.addIssue({
        code: 'custom',
        message: 'Plan selectors must retain source order70-100 and matching assets.',
      });
    if (content.controls.some(control => control.left >= control.right || control.top >= control.bottom))
      context.addIssue({ code: 'custom', message: 'Builder controls require positive hit bounds.' });
    const controls = [77055, 77322, 77698, 78076];
    if (content.controls.some((control, index) => control.offset !== controls[index]))
      context.addIssue({
        code: 'custom',
        message: 'Builder controls must retain the four recovered script identities.',
      });
  })
  .readonly();
export const constructionContent = ConstructionContentSchema.parse(raw);
export const constructionAsset = (file: string) => runtimeAssetUrl('assets/construction/' + file);
export const planIcon = (id: number | null) => {
  const icon = constructionContent.icons.find(icon => icon.id === (id ?? 100));
  if (!icon) throw Error('Missing recovered station plan selector: ' + id);
  return icon;
};
export const constructionAssets = () =>
  ['builder.svg', ...constructionContent.icons.map(icon => icon.file)].map(constructionAsset);
export const hitPath = (bounds: z.infer<typeof BoundsSchema>) =>
  'M' + bounds.left + ',' + bounds.top + ' H' + bounds.right + ' V' + bounds.bottom + ' H' + bounds.left + ' Z';
