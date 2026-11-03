/** Display-only target contract, independent of store and presentation adapters. */
import { z } from 'zod';
import { DurabilityComponentSchema, PositiveDefinitionIdSchema, RuntimeEntityIdSchema,
  StationPlacementIdSchema, SystemIdSchema } from '../simulation/model/entity-components';

const TargetIdentitySchema = z.object({
  id: RuntimeEntityIdSchema,
  definitionId: PositiveDefinitionIdSchema,
  systemId: SystemIdSchema,
  /** Target minus player position in world units; positive Y points down. */
  relativeX: z.number().finite(),
  relativeY: z.number().finite(),
});

/**
 * Static names, artwork and capacities remain in immutable module definitions.
 * Station condition is a nullable scalar, distinct from NPC hull/shields.
 * Consumers must never infer current strength from immutable content capacity.
 */
export const SelectedTargetViewSchema = z.discriminatedUnion('kind', [
  TargetIdentitySchema.extend({
    kind: z.literal('npc-ship'),
    displayName: z.string().min(1).nullable().default(null),
    hull: DurabilityComponentSchema.unwrap().shape.hull,
    shields: DurabilityComponentSchema.unwrap().shape.shields,
  }).strict().readonly(),
  TargetIdentitySchema.extend({
    kind: z.literal('station'),
    stationId: StationPlacementIdSchema,
    combat: z.object({ strength: z.number().positive().finite(), maximumStrength: z.number().positive().finite() }).strict().refine(value => value.strength <= value.maximumStrength, { message: 'Strength exceeds capacity' }).readonly().nullable().default(null),
  }).strict().readonly(),
]);

export type SelectedTargetView = z.infer<typeof SelectedTargetViewSchema>;
