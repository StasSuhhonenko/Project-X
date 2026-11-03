/** Maintained departure/arrival ink and Font2 boundary, in logical source pixels. */
import { z } from 'zod';
import { runtimeAssetUrl } from '../runtime-assets';
import { hasReviewedPlayerActorScale, PlayerActorScaleSchema } from '../player-actor-scale';
import raw from '../travel-data.json';
import { GlyphFontSchema, HudFieldSchema } from '../hud/hud-content';
const finite = z.number().finite();
export const TravelContentSchema = z.object({
  poses: z.array(z.object({
    frame: z.number().int(),
    file: z.string().regex(/^travel-departure-\d+\.svg$/),
  }).strict().readonly()).length(6).readonly(),
  ships: z.array(z.object({
    definitionId: z.number().int(),
    playerScale: PlayerActorScaleSchema.optional(),
    poses: z.array(z.object({
      frame: z.number().int(),
      file: z.string().regex(/^travel-ship-\d+-\d+\.svg$/),
    }).strict().readonly()).length(2).readonly(),
  }).strict().readonly()).length(10).readonly(),
  arrival: z.literal('travel-arrival.svg'),
  field: HudFieldSchema,
  font: GlyphFontSchema,
  continueBounds: z.object({
    left: finite,
    right: finite,
    top: finite,
    bottom: finite,
  }).strict().readonly(),
}).strict().superRefine((content, context) => {
  const fail = (message: string) => context.addIssue({ code: 'custom', message });
  if (!content.ships.every(hasReviewedPlayerActorScale)) fail('Player actor outer scale ownership changed');
  if (content.poses.map(p => p.frame).join(',') !== '3,10,11,15,16,20' || content.poses.some(p => p.file !== `travel-departure-${p.frame}.svg`)) fail('Departure source keyframe ownership changed');
  if (content.ships.map(s => s.definitionId).join(',') !== '6,7,16,18,25,29,30,31,39,44' || content.ships.some(s => s.poses.map(p => p.frame).join(',') !== '3,10' || s.poses.some(p => p.file !== `travel-ship-${s.definitionId}-${p.frame}.svg`))) fail('Selected ship source ownership changed');
  if (content.field.offset !== 24467 || content.field.variable !== 'events' || content.field.x !== 116.05 || content.field.y !== 34) fail('Arrival receiver ownership changed');
  if (new Set(content.font.glyphs.map(g => g.code)).size !== content.font.glyphs.length) fail('Duplicate arrival glyph');
  const b = content.continueBounds;
  if (b.left !== 426.95 || b.right !== 487.95 || b.top !== 308 || b.bottom !== 324) fail('Continue source bounds changed');
}).readonly();
export const travelContent = TravelContentSchema.parse(raw);
export const travelAsset = (file: string) => runtimeAssetUrl(`assets/travel/${file}`);
export const travelAssets = Object.freeze([
  travelContent.arrival,
  ...travelContent.poses.map(p => p.file),
  ...travelContent.ships.flatMap(s => s.poses.map(p => p.file)),
]);
/** Source success enters frame3, reaches frame20 after17 intervals, then removes
 * the actor. An18-interval host hold includes the terminal authored pose. */
export const TRAVEL_DEPARTURE_DURATION_MS = 18 * 1000 / 13;
