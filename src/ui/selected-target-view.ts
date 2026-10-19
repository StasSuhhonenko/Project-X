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
 * Stations have no runtime durability component: its absence is intentional,
 * and consumers must not manufacture current hull from a static capacity.
 */
export const SelectedTargetViewSchema = z.discriminatedUnion('kind', [
  TargetIdentitySchema.extend({
    kind: z.literal('npc-ship'),
    hull: DurabilityComponentSchema.unwrap().shape.hull,
    shields: DurabilityComponentSchema.unwrap().shape.shields,
  }).strict().readonly(),
  TargetIdentitySchema.extend({
    kind: z.literal('station'),
    stationId: StationPlacementIdSchema,
  }).strict().readonly(),
]);

export type SelectedTargetView = z.infer<typeof SelectedTargetViewSchema>;
