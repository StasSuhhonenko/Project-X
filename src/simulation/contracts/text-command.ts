/** Optional module-owned text interpretation; the engine owns validated writes. */
import { z } from 'zod';
import { SystemStandingSchema } from '../model/lifecycle-state';

/** Exact text, including whitespace and line breaks; 1024 UTF-16 code units at
 * most. Interpretation and any matching policy belong exclusively to a module. */
export const TextCommandIntentSchema = z
  .object({ text: z.string().max(1024) })
  .strict()
  .readonly();
export type TextCommandIntent = z.infer<typeof TextCommandIntentSchema>;

/** Sparse absolute assignments, never increments. Resources use whole module
 * resource units and safe nonnegative integers. Experience uses finite module
 * units; the progression owner additionally enforces its state invariants.
 * Standing uses signed finite module units without clamping. Omitted collections
 * mean no writes; all IDs/scopes must be declared and scopes must be unique.
 * Every write succeeds together or the entire result is refused. */
export const TextCommandResultSchema = z
  .object({
    resources: z.record(z.string(), z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)).default({}),
    experience: z.record(z.string(), z.number().finite()).default({}),
    standing: z.array(SystemStandingSchema).default([]),
  })
  .strict()
  .readonly();
export type TextCommandResult = z.infer<typeof TextCommandResultSchema>;

/** Frozen live facts only: no writable world, clock or random stream is exposed.
 * Resource balances use module units; system IDs identify declared scopes,
 * which may include scopes without a currently implemented spatial system. */
export interface TextCommandContext {
  /** Exact, untrimmed input. */
  readonly text: string;
  readonly resources: Readonly<Record<string, number>>;
  /** Player's current spatial system. */
  readonly systemId: number;
  readonly standingSystemIds: readonly number[];
}
