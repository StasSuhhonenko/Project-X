/** Reviewed source facts, validated once before any entry component is mounted.
 * Path coordinates are logical stage pixels, already composed from local source
 * matrices and twips. Asset names are local reviewed SVGs, never arbitrary URLs. */
import { runtimeAssetUrl } from '../runtime-assets';
import { z } from 'zod';
import raw from '../entry-data.json';

const asset = z.string().regex(/^[A-Za-z0-9-]+\.svg$/);
const control = z.object({
  scriptOffset: z.number().int().positive(), name: z.string(), depth: z.number().int(),
  paths: z.array(z.string().regex(/^[MLQZ0-9e., +\-]+$/)).min(1).readonly(),
  artwork: z.object({ up: asset, over: asset, down: asset, hit: asset }).nullable().readonly(),
}).readonly();
const bounds = z.object({ left: z.number(), top: z.number(), right: z.number(), bottom: z.number() }).readonly();
const PlaneIdSchema = z.enum(['UI-03:authoring', 'UI-04:authoring', 'UI-04.keys:authoring', 'UI-05:empty-slots', 'UI-06:neutral-entry', 'UI-06:neutral', 'UI-06:earth', 'UI-06:klingon', 'UI-06:ferengi', 'UI-06:romulan', 'UI-06:cardassian', 'UI-06:gul', 'UI-06:dominion', 'UI-06:borg', 'UI-06:vulcan', 'UI-07:neutral-entry', 'UI-07:neutral', 'UI-07:earth', 'UI-07:klingon', 'UI-07:ferengi', 'UI-07:romulan', 'UI-07:cardassian', 'UI-07:gul', 'UI-07:dominion', 'UI-07:borg', 'UI-07:vulcan']);
export const EntryContentSchema = z.object({
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  planes: z.array(z.object({ id: PlaneIdSchema, asset, controls: z.array(control).readonly() }).readonly()).readonly(),
  instructionControls: z.array(z.object({ scriptOffset: z.number().int(), bounds: z.array(bounds).readonly() }).readonly()).readonly(),
  starts: z.array(z.object({
    key: z.string(), label: z.string(), sourceOffset: z.number().int(),
  }).readonly()).readonly(),
}).superRefine((content, context) => {
  const fail = (message: string) => context.addIssue({ code: 'custom', message });
  if (new Set(content.planes.map(plane => plane.id)).size !== PlaneIdSchema.options.length
    || content.planes.length !== PlaneIdSchema.options.length) fail('Each required entry plane must have exactly one owner');
  content.planes.forEach(plane => {
    if (new Set(plane.controls.map(control => control.scriptOffset)).size !== plane.controls.length) fail(`Duplicate control action in ${plane.id}`);
  });
  const main = content.planes.find(plane => plane.id === 'UI-03:authoring');
  const mainActions = { menu1: 19306, menu4: 19467, menu2: 19617, menu3: 19781 };
  if (main?.controls.length !== 4 || !Object.entries(mainActions).every(([name, offset]) =>
    main.controls.some(control => control.name === name && control.scriptOffset === offset && control.artwork))) fail('Main controls must bind their reviewed route actions and authored artwork');
  if (new Set(content.starts.map(start => start.key)).size !== content.starts.length
    || new Set(content.starts.map(start => start.sourceOffset)).size !== content.starts.length) fail('Start identities must be distinct');
  [['neutral', 21929], ['earth', 23310], ['klingon', 25043], ['ferengi', 26585], ['romulan', 27982], ['cardassian', 31255], ['gul', 32492], ['dominion', 33627], ['borg', 34893], ['vulcan', 29457]].forEach(([key, offset]) => {
    if (!content.starts.some(start => start.key === key && start.sourceOffset === offset)) fail('Missing supported source start');
    if (!content.planes.filter(plane => plane.id.startsWith('UI-06:')).every(plane =>
      plane.controls.some(control => control.scriptOffset === offset))) fail('Supported start must remain selectable in each choice plane');
  });
  if (!content.planes.filter(plane => plane.id.startsWith('UI-07:')).every(plane =>
    [36965, 37628].every(offset => plane.controls.some(control => control.scriptOffset === offset)))) fail('Every supported preview needs Engage and Return');
}).readonly();
export type EntryControl = z.infer<typeof control>;
export const entryContent = EntryContentSchema.parse(raw);
export const entryAsset = (file: string) => runtimeAssetUrl(`assets/entry/${asset.parse(file)}`);
export function entryPlane(id: string) {
  const plane = entryContent.planes.find(value => value.id === id);
  if (!plane) throw new Error(`Missing reviewed entry plane ${id}`);
  return plane;
}
