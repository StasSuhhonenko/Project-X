/** Player intent to choose or clear one validated system destination. */
import { z } from 'zod';
import { SystemIdSchema } from '../model/entity-components';

export const DestinationSelectionIntentSchema = z.object({
  destinationSystemId: SystemIdSchema.nullable(),
}).strict().readonly();
export type DestinationSelectionIntent = z.infer<typeof DestinationSelectionIntentSchema>;
