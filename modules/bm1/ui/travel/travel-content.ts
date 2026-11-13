/** Maintained departure/arrival ink and Font2 boundary, in logical source pixels. */
import { z } from 'zod';
import { GlyphFontSchema, HudFieldSchema } from '../hud/hud-content';
import { SourceMatrixSchema } from '../player-hull-art';
import { runtimeAssetUrl } from '../runtime-assets';
import raw from '../travel-data.json';

const finite = z.number().finite();
export const TravelContentSchema = z
  .object({
    poses: z
      .array(
        z
          .object({
            frame: z.number().int(),
            file: z.string().regex(/^travel-departure-\d+\.svg$/),
          })
          .strict()
          .readonly()
      )
      .length(6)
      .readonly(),
    /** Ship-kind departure samples hold only the selected Symbol10 hull. Its
     * frame3 Symbol2 parent is recorded; player-hull-art paints the hull and the
     * compiled tween supplies the outer matrix. */
    shipPose: z
      .object({ frame: z.literal(3), parent: SourceMatrixSchema })
      .strict()
      .readonly(),
    arrival: z.literal('travel-arrival.svg'),
    field: HudFieldSchema,
    font: GlyphFontSchema,
    continueBounds: z
      .object({
        left: finite,
        right: finite,
        top: finite,
        bottom: finite,
      })
      .strict()
      .readonly(),
  })
  .strict()
  .superRefine((content, context) => {
    const fail = (message: string) => context.addIssue({ code: 'custom', message });
    if (
      content.poses.map(p => p.frame).join(',') !== '3,10,11,15,16,20' ||
      content.poses.some(p => p.file !== `travel-departure-${p.frame}.svg`)
    )
      fail('Departure source keyframe ownership changed');
    if (content.shipPose.parent.join(',') !== '1,0,0,1,300,225') fail('Departure player registration changed');
    if (
      content.field.offset !== 24467 ||
      content.field.variable !== 'events' ||
      content.field.x !== 116.05 ||
      content.field.y !== 34
    )
      fail('Arrival receiver ownership changed');
    if (new Set(content.font.glyphs.map(g => g.code)).size !== content.font.glyphs.length)
      fail('Duplicate arrival glyph');
    const b = content.continueBounds;
    if (b.left !== 426.95 || b.right !== 487.95 || b.top !== 308 || b.bottom !== 324)
      fail('Continue source bounds changed');
  })
  .readonly();
export const travelContent = TravelContentSchema.parse(raw);
export const travelAsset = (file: string) => runtimeAssetUrl(`assets/travel/${file}`);
export const travelAssets = Object.freeze([travelContent.arrival, ...travelContent.poses.map(p => p.file)]);
/** Source success enters frame3, reaches frame20 after17 intervals, then removes
 * the actor. An18-interval host hold includes the terminal authored pose. */
export { TRAVEL_DEPARTURE_DURATION_MS } from './departure-policy';
