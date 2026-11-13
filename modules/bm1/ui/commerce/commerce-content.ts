/** Maintained original merchant/selector geometry. Recovery and raw Flash
 * structures stay outside runtime; all source coordinates are logical pixels. */
import { z } from 'zod';
import raw from '../commerce-data.json';
import { HudFieldSchema } from '../hud/hud-content';
import { runtimeAssetUrl } from '../runtime-assets';

const finite = z.number().finite();
const asset = z.string().regex(/^commerce-(?:merchant|selector-(?:101|103|105))\.svg$/);
export const CommerceContentSchema = z
  .object({
    panel: asset,
    fields: z
      .array(
        z
          .object({
            transform: z.tuple([finite, finite, finite, finite, finite, finite]).readonly(),
            field: HudFieldSchema,
          })
          .strict()
          .readonly()
      )
      .length(1)
      .readonly(),
    controls: z
      .array(
        z
          .object({
            offset: z.number().int(),
            layer: z.number().int(),
            left: finite,
            top: finite,
            right: finite,
            bottom: finite,
            action: z.enum(['buy', 'sell', 'close', 'block']),
            row: z.number().int().min(0).max(7),
          })
          .strict()
          .readonly()
      )
      .length(18)
      .readonly(),
    icons: z
      .array(
        z
          .object({
            id: z.union([z.literal(101), z.literal(103), z.literal(105)]),
            file: asset,
            hitBounds: z.object({ left: finite, top: finite, right: finite, bottom: finite }).strict().readonly(),
          })
          .strict()
          .readonly()
      )
      .length(3)
      .readonly(),
    /** Symbol3 FLA shape82032 (compiled shape714, depth37): eight horizontal
     * #cccccc row separators, painted above the backdrop/row buttons and below
     * the text fields. Stage pixels; widths are centered stroke pixels. */
    separators: z
      .object({
        offset: z.literal(82032),
        lines: z
          .array(
            z
              .object({
                x1: finite,
                x2: finite,
                y: finite,
                width: z.union([z.literal(1), z.literal(0.5)]),
                rgba: z.tuple([z.literal(204), z.literal(204), z.literal(204), z.literal(255)]),
              })
              .strict()
              .readonly()
          )
          .length(8)
          .readonly(),
      })
      .strict()
      .readonly(),
  })
  .strict()
  .superRefine((content, context) => {
    if (content.fields[0]?.field.variable !== 'merchanttext' || content.panel !== 'commerce-merchant.svg')
      context.addIssue({ code: 'custom', message: 'Changed merchant source receiver.' });
    (['buy', 'sell'] as const).forEach(action => {
      const rows = content.controls.filter(control => control.action === action).map(control => control.row);
      if (rows.length !== 8 || new Set(rows).size !== 8)
        context.addIssue({ code: 'custom', message: 'Eight distinct merchant rows required.' });
    });
    if (new Set(content.icons.map(icon => icon.id)).size !== 3)
      context.addIssue({ code: 'custom', message: 'Distinct source resource/trade selectors required.' });
  })
  .readonly();
export const commerceContent = CommerceContentSchema.parse(raw);
export const commerceAsset = (file: string) => runtimeAssetUrl(`assets/commerce/${asset.parse(file)}`);
export function commerceIcon(id: 101 | 103 | 105) {
  return commerceContent.icons.find(icon => icon.id === id)!;
}
export function commerceHitPath(id: 101 | 103 | 105) {
  const b = commerceIcon(id).hitBounds;
  return `M${b.left},${b.top} H${b.right} V${b.bottom} H${b.left} Z`;
}
