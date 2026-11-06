/** Maintained UI-21 source registration; no navigation policy lives here. */
import { z } from 'zod';
import { HudFieldSchema } from '../hud/hud-content';
import raw from '../map-data.json';
import { runtimeAssetUrl } from '../runtime-assets';
import { MAP_LAYOUT as layout } from './map-layout';

const n = z.number().finite();
const asset = z.string().regex(/^map-[a-z]+\.svg$/);
export const MapContentSchema = z
  .object({
    frame: asset,
    selected: asset,
    maskPath: z.string().min(1),
    fields: z
      .array(
        z
          .object({
            field: HudFieldSchema,
            transform: z.tuple([n, n, n, n, n, n]).readonly(),
          })
          .strict()
          .readonly()
      )
      .readonly(),
    markers: z
      .array(
        z
          .object({
            systemId: z.number().int().positive(),
            offset: z.number().int(),
            x: n,
            y: n,
            paths: z.array(z.string()).min(1).readonly(),
          })
          .strict()
          .readonly()
      )
      .length(50)
      .readonly(),
    controls: z
      .array(
        z
          .object({
            offset: z.number().int(),
            layer: z.number().int(),
            left: n,
            top: n,
            right: n,
            bottom: n,
          })
          .strict()
          .readonly()
      )
      .readonly(),
  })
  .strict()
  .superRefine((v, c) => {
    const ids = new Set(v.markers.map(m => m.systemId));
    if (ids.size !== 50 || [...ids].some(id => id < 1 || id > 50)) {
      c.addIssue({ code: 'custom', message: 'Original marker IDs 1 through 50 required' });
    }
    if (
      !v.controls.some(c => c.offset === layout.closeOffset) ||
      !v.controls.some(c => c.offset === layout.blockerOffset)
    ) {
      c.addIssue({ code: 'custom', message: 'Source Close and blocker required' });
    }
    if (v.controls.length !== 2 || v.controls.some(c => c.right <= c.left || c.bottom <= c.top)) {
      c.addIssue({ code: 'custom', message: 'Positive source control geometry required' });
    }
    if (v.frame !== 'map-frame.svg' || v.selected !== 'map-current.svg') {
      c.addIssue({ code: 'custom', message: 'Distinct source asset owners required' });
    }
    if (new Set(v.fields.map(f => f.field.offset)).size !== 51 || v.fields.length !== 51) {
      c.addIssue({ code: 'custom', message: 'Maptext and fifty source name fields required' });
    }
    const expected = `M${layout.maskRight},${layout.maskTop} L${layout.maskRight},${layout.maskBottom} L${layout.maskLeft},${layout.maskBottom} L${layout.maskLeft},${layout.maskTop} L${layout.maskRight},${layout.maskTop} Z`;
    if (v.maskPath !== expected) {
      c.addIssue({ code: 'custom', message: 'Exact authored map mask required' });
    }
  })
  .readonly();
export const mapContent = MapContentSchema.parse(raw);
export const mapAsset = (file: string) => runtimeAssetUrl(`assets/map/${file}`);
export const mapAssets = Object.freeze([mapContent.frame, mapContent.selected]);
