/** Maintained original selector geometry; simulation never imports these data. */
import { z } from 'zod';
import raw from '../equipment-data.json';
import { HudFieldSchema } from '../hud/hud-content';
import { runtimeAssetUrl } from '../runtime-assets';

const finite = z.number().finite();
const matrix = z.object({ a: finite, b: finite, c: finite, d: finite, tx: finite, ty: finite }).strict().readonly();
const slot = z
  .object({ index: z.number().int().nonnegative(), offset: z.number().int().positive(), matrix })
  .strict()
  .readonly();
const asset = z.string().regex(/^equipment-[a-z0-9-]+\.svg$/);
export const equipmentContent = z
  .object({
    icons: z
      .array(
        z
          .object({
            hitBounds: z.object({ left: finite, top: finite, right: finite, bottom: finite }).strict().readonly(),
            id: z.number().int().positive(),
            file: asset,
          })
          .strict()
          .readonly()
      )
      .length(27)
      .readonly(),
    owned: z.array(slot).length(9).readonly(),
    stationSlots: z.array(slot).length(6).readonly(),
    saleSlots: z.array(slot).length(10).readonly(),
    equipped: z
      .array(
        z
          .object({ channel: z.number().int().min(0).max(2), offset: z.number().int(), matrix })
          .strict()
          .readonly()
      )
      .length(3)
      .readonly(),
    sale: z
      .object({
        panel: asset,
        fields: z
          .array(
            z
              .object({
                field: HudFieldSchema,
                transform: z.tuple([finite, finite, finite, finite, finite, finite]).readonly(),
              })
              .strict()
              .readonly()
          )
          .readonly(),
        // Diagnostic recovery-only control metadata stays outside runtime authority;
        // only the exact reviewed offset and rectangular Hit geometry is projected.
        controls: z
          .array(
            z
              .object({
                offset: z.number().int(),
                stageBounds: z.object({ left: finite, top: finite, right: finite, bottom: finite }).readonly(),
              })
              .strip()
              .readonly()
          )
          .readonly(),
      })
      .strict()
      .readonly(),
  })
  .strict()
  .readonly()
  .parse(raw);
export const equipmentAsset = (file: string) => runtimeAssetUrl(`assets/equipment/${file}`);
export const equipmentAssets = Object.freeze([
  ...equipmentContent.icons.map(icon => icon.file),
  equipmentContent.sale.panel,
]);
export const sourceMatrix = (m: z.infer<typeof matrix>) => `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.tx} ${m.ty})`;

/** Source displayed vector/bitmap union supplies the clip release region. */
export function equipmentHitPath(weaponId: number): string {
  const b = equipmentContent.icons.find(icon => icon.id === weaponId)!.hitBounds;
  return `M${b.left},${b.top} H${b.right} V${b.bottom} H${b.left} Z`;
}
