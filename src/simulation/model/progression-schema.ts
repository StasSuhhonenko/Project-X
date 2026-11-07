/** Canonical data contracts, independent of world operations to avoid cycles. */
import { z } from 'zod';
import { UInt32Schema } from '../../random/seeded-random';
import { NonNegativeNumberSchema, StationPlacementIdSchema } from './entity-components';

/** Module-declared skill/tally key: the shared lowercase kebab-case content ID form. */
export const ProgressionIdSchema = StationPlacementIdSchema;
const ValuesSchema = z.record(ProgressionIdSchema, NonNegativeNumberSchema).readonly();
const NamedIdSchema = z
  .object({ id: ProgressionIdSchema, label: z.string().min(1) })
  .strict()
  .readonly();
/** Skills and tallies have separate namespaces, each with unique IDs. */
export const ProgressionDefinitionSchema = z
  .object({
    skills: z.array(NamedIdSchema).readonly(),
    tallies: z.array(NamedIdSchema).readonly(),
  })
  .strict()
  .superRefine((definition, context) => {
    (['skills', 'tallies'] as const).forEach(key => {
      if (new Set(definition[key].map(item => item.id)).size !== definition[key].length)
        context.addIssue({ code: 'custom', path: [key], message: 'Progression IDs must be unique.' });
    });
  })
  .readonly();
export type ProgressionDefinition = z.infer<typeof ProgressionDefinitionSchema>;
export const ProgressionStateSchema = z
  .object({
    experience: ValuesSchema,
    tallies: ValuesSchema,
    randomState: UInt32Schema,
  })
  .strict()
  .readonly();
export type ProgressionState = z.infer<typeof ProgressionStateSchema>;
/** Sparse additive increments; omitted maps are empty. Zero is valid. */
export const ProgressionDeltaSchema = z
  .object({
    experience: ValuesSchema.default({}),
    tallies: ValuesSchema.default({}),
  })
  .strict()
  .readonly();
export type ProgressionDelta = z.infer<typeof ProgressionDeltaSchema>;
