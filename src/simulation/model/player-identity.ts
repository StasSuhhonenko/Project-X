/** Display identity, independent of faction membership, credentials or balance. */
import { z } from 'zod';

/**
 * Names are literal single-line text: empty/whitespace values are meaningful.
 * Do not coerce, trim or impose an arbitrary character limit. File adapters
 * separately limit imported file size; malformed multiline imports are rejected
 * rather than silently rewritten to what a native text input would display.
 */
const SingleLineNameSchema = z
  .string()
  .refine(value => !/[\r\n\u2028\u2029]/u.test(value), 'Identity names must be single-line text.');

/** A label never changes government definitions, ownership or unlock rules. */
export const PlayerIdentitySchema = z
  .object({
    captainName: SingleLineNameSchema,
    shipName: SingleLineNameSchema,
    governmentName: SingleLineNameSchema,
  })
  .strict()
  .readonly();

export type PlayerIdentity = z.infer<typeof PlayerIdentitySchema>;
