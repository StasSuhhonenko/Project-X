/** Original type13 receiver/control geometry. All positions are logical stage
 * pixels; maintained derivative provenance is checked separately at staging. */
import { z } from 'zod';
import raw from '../communication-data.json';
import { HudFieldSchema } from '../hud/hud-content';
import { runtimeAssetUrl } from '../runtime-assets';

const finite = z.number().finite();
export const CommunicationContentSchema = z
  .object({
    asset: z.literal('communication-report.svg'),
    field: HudFieldSchema,
    controls: z
      .array(
        z
          .object({
            offset: z.number().int(),
            layer: z.number().int(),
            left: finite,
            right: finite,
            top: finite,
            bottom: finite,
          })
          .strict()
          .readonly()
      )
      .length(2)
      .readonly(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.field.offset !== 76096 ||
      value.field.variable !== 'event' ||
      !value.controls.some(c => c.offset === 76338 && c.layer === 3) ||
      !value.controls.some(c => c.offset === 1862 && c.layer === 1) ||
      value.controls.some(c => c.right <= c.left || c.bottom <= c.top)
    )
      context.addIssue({ code: 'custom', message: 'Original report receiver and controls required' });
  })
  .readonly();
export const communicationContent = CommunicationContentSchema.parse(raw);
export const communicationAsset = (file: string) => runtimeAssetUrl(`assets/communication/${file}`);
export const communicationAssets = Object.freeze([communicationContent.asset]);
