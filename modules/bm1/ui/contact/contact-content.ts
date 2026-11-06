/** Maintained source UI-17/18/19 geometry, in settled 600×450 stage pixels.
 * The common (303,110) registration, including its growth transform, belongs
 * to presentation. These records grant no eligibility or economic command. */
import { z } from 'zod';
import raw from '../contact-data.json';
import { HudFieldSchema } from '../hud/hud-content';
import { runtimeAssetUrl } from '../runtime-assets';

const finite = z.number().finite();
/** Safe maintained contact filename; staging separately authenticates its bytes. */
export const ContactAssetSchema = z.string().regex(/^contact-[A-Za-z0-9-]+\.svg$/);
/** Authenticated source Exit owners, shared by validation and dispatch. */
export const CONTACT_EXIT_OFFSETS = Object.freeze({
  'UI-17': 38099,
  'UI-18': 32930,
  'UI-19': 67680,
} as const);
/** Source Buy Goods body 34673, release/rollover script 34761. Geometry remains
 * solely in contact-data.json, shared with contact inspection and validation. */
export const CONTACT_BUY_OFFSET = 34673;
/** One immutable source plane, with receiver transforms and Up-derived Hits. */
export const ContactPlaneSchema = z
  .object({
    id: z.enum(['UI-17', 'UI-18', 'UI-19']),
    asset: ContactAssetSchema,
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
      .readonly(),
  })
  .strict()
  .readonly();
export const ContactContentSchema = z
  .object({
    planes: z.array(ContactPlaneSchema).length(3).readonly(),
    planets: z
      .array(
        z
          .object({
            systemId: z.number().int().positive(),
            surfaceTypeId: z.number().int().positive(),
            asset: ContactAssetSchema,
          })
          .strict()
          .readonly()
      )
      .readonly(),
    stations: z
      .array(
        z
          .object({
            definitionId: z.number().int().positive(),
            typeLabel: z.string().min(1),
            asset: ContactAssetSchema,
          })
          .strict()
          .readonly()
      )
      .readonly(),
  })
  .strict()
  .superRefine((content, context) => {
    const reject = (message: string) => context.addIssue({ code: 'custom', message });
    if (new Set(content.planes.map(p => p.id)).size !== 3) reject('Distinct contact plane owners required');
    if (new Set(content.planets.map(p => p.systemId)).size !== content.planets.length)
      reject('Duplicate contact planet owner');
    if (new Set(content.stations.map(p => p.definitionId)).size !== content.stations.length)
      reject('Duplicate contact station owner');
    content.planes.forEach(p => {
      if (p.asset !== `contact-${p.id}.svg`) reject('Contact asset must match its source owner');
      if (!p.controls.every(c => c.right > c.left && c.bottom > c.top)) reject('Invalid contact Hit extent');
      const exit = CONTACT_EXIT_OFFSETS[p.id];
      if (!p.controls.some(c => c.offset === exit)) reject('Missing contact Exit owner');
    });
  })
  .readonly();
export const contactContent = ContactContentSchema.parse(raw);
export const contactAsset = (file: string) => runtimeAssetUrl(`assets/contact/${file}`);
export const contactAssets = Object.freeze(
  [...contactContent.planes, ...contactContent.planets, ...contactContent.stations].map(p => p.asset)
);
