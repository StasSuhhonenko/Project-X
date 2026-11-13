/** Validated prepared UI-26 geometry, in logical stage pixels. */
import { z } from 'zod';
import raw from '../cheat-data.json';
import { HudFieldSchema } from '../hud/hud-content';
import { runtimeAssetUrl } from '../runtime-assets';

export const CheatContentSchema = z
  .object({
    asset: z.literal('cheat-submit.svg'),
    field: HudFieldSchema,
    multiline: z.literal(true),
    /** Symbol3 FLA shape31473 (compiled shape764, depth3): opaque black
     * rectangle with a centered 3px #990000 stroke, drawn between the button
     * (depth1) and the input field (depth4). Stage pixels at parent (303,110). */
    box: z
      .object({
        offset: z.literal(31473),
        left: z.literal(167.05),
        top: z.literal(100),
        right: z.literal(452),
        bottom: z.literal(121),
        fill: z.tuple([z.literal(0), z.literal(0), z.literal(0), z.literal(255)]),
        stroke: z.tuple([z.literal(153), z.literal(0), z.literal(0), z.literal(255)]),
        strokeWidth: z.literal(3),
      })
      .strict()
      .readonly(),
    control: z
      .object({
        offset: z.literal(3432),
        libraryReference: z.literal(127),
        mediaId: z.literal(117),
        left: z.literal(393.3),
        right: z.literal(454.3),
        top: z.literal(126.85),
        bottom: z.literal(142.85),
      })
      .strict()
      .readonly(),
  })
  .strict()
  .superRefine((value, context) => {
    const f = value.field;
    if (
      f.offset !== 91878 ||
      f.variable !== 'cheattext' ||
      f.x !== 173 ||
      f.y !== 104.9 ||
      f.width !== 274.95 ||
      f.height !== 10.05 ||
      f.size !== 9 ||
      !f.wrap ||
      f.rgba.some(channel => channel !== 255)
    )
      context.addIssue({ code: 'custom', message: 'Original type27 input receiver required' });
  })
  .readonly();
export const cheatContent = CheatContentSchema.parse(raw);
export const cheatAsset = () => runtimeAssetUrl(`assets/cheat/${cheatContent.asset}`);
