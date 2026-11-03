/** Maintained UI-27 source geometry; all distances are local logical pixels. */
import { z } from 'zod';
import { runtimeAssetUrl } from '../runtime-assets';
import raw from '../repair-data.json';
/** Accepted baseline fixture canvas and registration, in logical source pixels. */
export const REPAIR_LAYOUT = Object.freeze({ stageWidth: 600, stageHeight: 450, fixtureX: 300, fixtureY: 225 });
const finite = z.number().finite();
const BoundsSchema = z.object({ left: finite, right: finite, top: finite, bottom: finite }).strict().refine(b => b.right > b.left && b.bottom > b.top, 'Invalid repair bounds').readonly();
export const RepairContentSchema = z.object({
  poses: z.array(z.object({ file: z.string().regex(/^repair-\d+\.svg$/), frame: z.number().int().min(1).max(27) }).strict().readonly()).length(10).readonly(),
  cancel: BoundsSchema, bounds: BoundsSchema,
}).strict().superRefine((data, context) => {
  if (data.poses.map(p => p.frame).join(',') !== '1,5,6,11,12,17,18,22,23,27') context.addIssue({ code: 'custom', message: 'Repair keypose owners changed' });
  if (data.poses.some(p => p.file !== `repair-${p.frame}.svg`)) context.addIssue({ code: 'custom', message: 'Repair asset owner mismatch' });
}).readonly();
export const repairContent = RepairContentSchema.parse(raw);
export const repairAsset = (file: string) => runtimeAssetUrl(`assets/repair/${file}`);
export const repairAssets = Object.freeze(repairContent.poses.map(p => p.file));
