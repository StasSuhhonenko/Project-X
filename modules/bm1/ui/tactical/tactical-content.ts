/** Maintained UI-10 assets. Geometry is in original 600x450 stage pixels at
 * settled parent (90,410). Inputs are validated before mounting any artwork. */
import { z } from 'zod';
import { runtimeAssetUrl } from '../runtime-assets';
import raw from '../tactical-data.json';

export const TacticalAssetSchema = z.string().regex(/^target-[a-z0-9-]+\.svg$/);
const asset = TacticalAssetSchema;
export const TacticalContentSchema = z
  .object({
    background: asset,
    disabled: asset,
    arrow: asset,
    previews: z.array(z.object({ definitionId: z.number().int().positive(), asset }).strict().readonly()).readonly(),
    scan: z
      .object({
        left: z.number().finite(),
        top: z.number().finite(),
        right: z.number().finite(),
        bottom: z.number().finite(),
      })
      .strict()
      .readonly(),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.previews.map(p => p.definitionId)).size !== value.previews.length)
      context.addIssue({ code: 'custom', message: 'Duplicate tactical preview owner' });
    if (value.scan.right <= value.scan.left || value.scan.bottom <= value.scan.top)
      context.addIssue({ code: 'custom', message: 'Invalid SCAN Hit rectangle' });
  })
  .readonly();
export const tacticalContent = TacticalContentSchema.parse(raw);
export const tacticalAsset = (file: string) => runtimeAssetUrl(`assets/tactical/${file}`);
export const tacticalAssets = Object.freeze([
  tacticalContent.background,
  tacticalContent.disabled,
  tacticalContent.arrow,
  ...tacticalContent.previews.map(p => p.asset),
]);
