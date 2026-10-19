/** Minimal contact inspection data; opening a contact never mutates the world. */
import { z } from 'zod';
import { PositiveDefinitionIdSchema, RuntimeEntityIdSchema, StationPlacementIdSchema,
  SystemIdSchema } from '../simulation/model/entity-components';

const ContactIdentitySchema = z.object({
  id: RuntimeEntityIdSchema,
  systemId: SystemIdSchema,
  /** Contact minus player position in world units; positive Y points down. */
  relativeX: z.number().finite(),
  relativeY: z.number().finite(),
});

/** Planet descriptions and initial population/government remain module content. */
export const PlanetContactViewSchema = ContactIdentitySchema.extend({
  kind: z.literal('planet'),
}).strict().readonly();
export type PlanetContactView = z.infer<typeof PlanetContactViewSchema>;

/**
 * Inspection exposes existing identity and geometry, never inferred hail access,
 * reputation, NPC names/races/dialogue, current station condition or inventory.
 * Resolve static class and placement labels from the immutable module definition.
 */
export const SelectedContactViewSchema = z.discriminatedUnion('kind', [
  ContactIdentitySchema.extend({
    kind: z.literal('station'),
    definitionId: PositiveDefinitionIdSchema,
    stationId: StationPlacementIdSchema,
  }).strict().readonly(),
  ContactIdentitySchema.extend({
    kind: z.literal('npc-ship'),
    definitionId: PositiveDefinitionIdSchema,
  }).strict().readonly(),
]);
export type SelectedContactView = z.infer<typeof SelectedContactViewSchema>;
