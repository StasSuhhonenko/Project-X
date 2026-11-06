/** Maintained original type21 geometry. Source offsets identify controls;
 * they never grant authority to charge resources or replace a vessel. */
import { z } from 'zod';
import { HudFieldSchema } from '../hud/hud-content';
import { runtimeAssetUrl } from '../runtime-assets';
import raw from '../shipyard-data.json';

const finite = z.number().finite();
const asset = z.string().regex(/^shipyard-[a-z0-9-]+\.svg$/);
const bounds = z.object({ left: finite, top: finite, right: finite, bottom: finite }).strict().readonly();
const transform = z.tuple([finite, finite, finite, finite, finite, finite]).readonly();
export const ShipyardContentSchema = z
  .object({
    panel: asset,
    fields: z
      .array(
        z
          .object({
            field: HudFieldSchema,
            transform,
          })
          .strict()
          .readonly()
      )
      .length(3)
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
          })
          .strict()
          .readonly()
      )
      .length(4)
      .readonly(),
    ships: z
      .array(
        z
          .object({
            definitionId: z.number().int().positive(),
            asset,
            bounds,
          })
          .strict()
          .readonly()
      )
      .readonly(),
    listingSlots: z
      .array(
        z
          .object({
            slot: z.number().int().min(0).max(5),
            offset: z.number().int().positive(),
            transform,
          })
          .strict()
          .readonly()
      )
      .length(6)
      .readonly(),
  })
  .strict()
  .superRefine((content, context) => {
    if (![2760, 82801, 83385, 85723].every(offset => content.controls.some(control => control.offset === offset)))
      context.addIssue({ code: 'custom', message: 'Missing original ship preview control' });
    if (new Set(content.ships.map(ship => ship.definitionId)).size !== content.ships.length)
      context.addIssue({ code: 'custom', message: 'Duplicate ship preview identity' });
    if (new Set(content.listingSlots.map(slot => slot.slot)).size !== 6)
      context.addIssue({ code: 'custom', message: 'Planet listing requires six distinct source slots' });
  })
  .readonly();
export const shipyardContent = ShipyardContentSchema.parse(raw);
export const shipyardAsset = (file: string) => runtimeAssetUrl(`assets/shipyard/${file}`);
export const shipyardAssets = Object.freeze([shipyardContent.panel, ...shipyardContent.ships.map(ship => ship.asset)]);
