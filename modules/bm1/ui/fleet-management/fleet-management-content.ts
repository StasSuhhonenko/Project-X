/** Validated, source-derived type-25 geometry in settled 600×450 stage pixels. */
import { z } from 'zod';
import type { FleetManagementView } from '@engine/ui/fleet-management-view';
import { equipmentAsset, equipmentContent } from '../equipment/equipment-content';
import raw from '../fleet-management-data.json';
import { HudFieldSchema } from '../hud/hud-content';
import { runtimeAssetUrl } from '../runtime-assets';

const finite = z.number().finite();
const PathSchema = z.string().regex(/^M -?\d+(?:\.\d+)? -?\d+(?:\.\d+)?(?: L -?\d+(?:\.\d+)? -?\d+(?:\.\d+)?)+ Z$/);
const HitSchema = z.array(PathSchema).min(1).readonly();
const ActionSchema = z.enum([
  'next',
  'previous',
  'exit',
  'destination-previous',
  'destination-next',
  'send',
  'decommission',
  'trade',
  'patrol',
]);
export type FleetManagementAction = z.infer<typeof ActionSchema>;

const ImageSchema = z
  .object({
    depth: z.union([z.literal(4), z.literal(23), z.literal(26), z.literal(29), z.literal(38)]),
    file: z.enum(['backdrop.svg', 'cheat-submit.svg', 'action-icons.svg', 'divider.svg']),
    x: finite,
    y: finite,
    width: finite.positive(),
    height: finite.positive(),
  })
  .strict()
  .readonly();
const FieldSchema = z
  .object({
    depth: z.union([
      z.literal(5),
      z.literal(13),
      z.literal(16),
      z.literal(17),
      z.literal(20),
      z.literal(25),
      z.literal(28),
    ]),
    label: z.enum(['', '<<', '>>', 'Exit Menu']),
    field: HudFieldSchema,
  })
  .strict()
  .readonly();
const ControlSchema = z
  .object({
    action: ActionSchema,
    depth: z.union([
      z.literal(14),
      z.literal(18),
      z.literal(21),
      z.literal(23),
      z.literal(26),
      z.literal(30),
      z.literal(32),
      z.literal(34),
      z.literal(36),
    ]),
    offset: z.number().int().positive(),
    label: z.string().min(1),
    hint: z.string(),
    paths: HitSchema,
  })
  .strict()
  .readonly();

export const FleetManagementContentSchema = z
  .object({
    type: z.literal(25),
    blocker: HitSchema,
    images: z.array(ImageSchema).length(5).readonly(),
    portrait: z
      .object({
        depth: z.literal(9),
        transform: z.object({ a: finite, b: finite, c: finite, d: finite, tx: finite, ty: finite }).strict().readonly(),
      })
      .strict()
      .readonly(),
    fields: z.array(FieldSchema).length(7).readonly(),
    controls: z.array(ControlSchema).length(9).readonly(),
  })
  .strict()
  .superRefine((content, ctx) => {
    const imageFilesByDepth = {
      4: 'backdrop.svg',
      23: 'cheat-submit.svg',
      26: 'cheat-submit.svg',
      29: 'action-icons.svg',
      38: 'divider.svg',
    };
    if (
      new Set(content.images.map(image => image.depth)).size !== content.images.length ||
      content.images.some(image => image.file !== imageFilesByDepth[image.depth])
    )
      ctx.addIssue({ code: 'custom', path: ['images'], message: 'Each depth requires its source artwork.' });
    const fieldsByDepth = {
      5: ['loctext', ''],
      13: ['', '>>'],
      16: ['itemdesc', ''],
      17: ['', '<<'],
      20: ['', 'Exit Menu'],
      25: ['', '<<'],
      28: ['', '>>'],
    };
    if (
      new Set(content.fields.map(item => item.depth)).size !== content.fields.length ||
      content.fields.some(({ depth, field, label }) => {
        const [variable, expectedLabel] = fieldsByDepth[depth]!;
        return field.variable !== variable || label !== expectedLabel || field.wrap !== (depth === 16);
      })
    )
      ctx.addIssue({ code: 'custom', path: ['fields'], message: 'Each depth requires its source receiver or label.' });
    if (
      new Set(content.controls.map(control => control.action)).size !== content.controls.length ||
      new Set(content.controls.map(control => control.depth)).size !== content.controls.length ||
      new Set(content.controls.map(control => control.offset)).size !== content.controls.length
    )
      ctx.addIssue({
        code: 'custom',
        path: ['controls'],
        message: 'Controls must have unique actions, depths and handlers.',
      });
  })
  .readonly();

export const fleetManagementContent = FleetManagementContentSchema.parse(raw);

export function fleetManagementImageUrl(file: z.infer<typeof ImageSchema>['file']): string {
  return runtimeAssetUrl(file === 'cheat-submit.svg' ? `assets/cheat/${file}` : `assets/fleet-management/${file}`);
}

/** Symbol 7's local coordinates and ink are shared with the hull sale panel.
 * The type-25 attachment supplies its own clip transform. */
export function fleetManagementPortraitUrl(definitionId: number): string {
  const portrait = equipmentContent.shipIcons.find(icon => icon.id === definitionId);
  if (!portrait) throw new Error(`Missing fleet management portrait for hull ${definitionId}.`);
  return equipmentAsset(portrait.file);
}

export function fleetManagementArtworkAssets(
  rows: readonly Pick<FleetManagementView['rows'][number], 'definitionId'>[] = []
) {
  return [
    ...new Set([
      ...fleetManagementContent.images.map(image => fleetManagementImageUrl(image.file)),
      ...rows.map(row => fleetManagementPortraitUrl(row.definitionId)),
    ]),
  ];
}
