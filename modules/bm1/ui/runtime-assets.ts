/** Publication paths are module data, not recovery filenames or gameplay IDs.
 * UI source keys remain stable for provenance; this validated map resolves them
 * to descriptive public paths. Missing keys fail before rendering broken ink. */
import { z } from 'zod';
import raw from '../runtime-asset-paths.json';

const source = z.string().regex(/^assets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:png|svg|wav)$/);
const published = z.string().regex(/^assets\/(?:ships|stations|planets|backgrounds|ui|effects|audio)\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.(?:png|svg|wav)$/);
export const RuntimeAssetPathsSchema = z.record(source, published).superRefine((paths, context) => {
  if (new Set(Object.values(paths)).size !== Object.keys(paths).length) {
    context.addIssue({ code: 'custom', message: 'Public asset names must be unique.' });
  }
}).readonly();
export const runtimeAssetPaths = RuntimeAssetPathsSchema.parse(raw);

export function runtimeAssetUrl(sourcePath: string): string {
  const publicPath = runtimeAssetPaths[sourcePath];
  if (!publicPath) throw Error(`Missing published asset: ${sourcePath}`);
  return `/game/${publicPath}`;
}
