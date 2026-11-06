/** Validate the local model envelope before GLTFLoader can discover resources.
 * The proof deliberately supports one embedded buffer and no image dependencies. */
import { z } from 'zod';
const EnvelopeSchema = z.object({
  asset: z.object({ version: z.literal('2.0') }),
  buffers: z.array(z.object({ byteLength: z.number().int().positive(), uri: z.never().optional() })).length(1),
  images: z.array(z.never()).max(0).optional(),
  extensionsRequired: z.array(z.never()).max(0).optional(),
});

export function validateSelfContainedGlb(buffer: ArrayBuffer): void {
  const bytes = new DataView(buffer);
  if (buffer.byteLength < 28 || bytes.getUint32(0, true) !== 0x46546c67
    || bytes.getUint32(4, true) !== 2 || bytes.getUint32(8, true) !== buffer.byteLength)
    throw new Error('Invalid local GLB envelope.');
  const length = bytes.getUint32(12, true);
  if (bytes.getUint32(16, true) !== 0x4e4f534a || length % 4 !== 0 || 20 + length + 8 > buffer.byteLength)
    throw new Error('Invalid GLB JSON chunk.');
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length)));
  const rejectExternal = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    Object.entries(value).forEach(([key, child]) => {
      if (key === 'uri' || key === 'extensions') throw new Error('External or extended model resources are forbidden.');
      rejectExternal(child);
    });
  };
  rejectExternal(json);
  const envelope = EnvelopeSchema.parse(json);
  const binaryOffset = 20 + length;
  const binaryLength = bytes.getUint32(binaryOffset, true);
  if (bytes.getUint32(binaryOffset + 4, true) !== 0x004e4942 || binaryOffset + 8 + binaryLength !== buffer.byteLength
    || binaryLength < envelope.buffers[0]!.byteLength || binaryLength - envelope.buffers[0]!.byteLength > 3)
    throw new Error('Invalid GLB embedded buffer.');
}
