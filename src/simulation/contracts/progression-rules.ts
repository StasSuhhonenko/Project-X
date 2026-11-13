/** Bounded events for implemented progression hosts only. */
import { z } from 'zod';
import { UInt32Schema } from '../../random/seeded-random';
import { PositiveDefinitionIdSchema, SystemIdSchema } from '../model/entity-components';
import { ProgressionDeltaSchema, ProgressionStateSchema } from '../model/progression-state';

const common = { progression: ProgressionStateSchema, randomState: UInt32Schema };
export const ProgressionEventSchema = z.discriminatedUnion('kind', [
  // Awarded once for every eligible boarding, independently of its outcome.
  z
    .object({ ...common, kind: z.literal('ship-boarded') })
    .strict()
    .readonly(),
  z
    .object({ ...common, kind: z.literal('contract-accept'), offerKind: z.enum(['planet', 'station']) })
    .strict()
    .readonly(),
  z
    .object({ ...common, kind: z.literal('contract-negotiate') })
    .strict()
    .readonly(),
  z
    .object({ ...common, kind: z.literal('contract-delivery'), destinationSystemId: SystemIdSchema })
    .strict()
    .readonly(),
  z
    .object({ ...common, kind: z.literal('surface-mission'), standingDelta: z.number().finite() })
    .strict()
    .readonly(),
  z
    .object({
      ...common,
      kind: z.literal('travel-departure'),
      originSystemId: SystemIdSchema,
      destinationSystemId: SystemIdSchema,
    })
    .strict()
    .readonly(),
  z
    .object({ ...common, kind: z.literal('repair-start') })
    .strict()
    .readonly(),
  z
    .object({
      ...common,
      kind: z.literal('weapon-fire'),
      weaponDefinitionId: PositiveDefinitionIdSchema,
      channel: z.enum(['primary', 'special']),
    })
    .strict()
    .readonly(),
]);
export type ProgressionEvent = z.infer<typeof ProgressionEventSchema>;
/** Returned RNG state belongs exclusively to progression, including empty deltas. */
export const ProgressionResultSchema = z
  .object({ delta: ProgressionDeltaSchema, randomState: UInt32Schema })
  .strict()
  .readonly();
export type ProgressionResult = z.infer<typeof ProgressionResultSchema>;
