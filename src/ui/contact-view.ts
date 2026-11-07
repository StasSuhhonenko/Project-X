/** Minimal contact inspection data; opening a contact never mutates the world. */
import { z } from 'zod';
import {
  PositiveDefinitionIdSchema,
  RuntimeEntityIdSchema,
  StationPlacementIdSchema,
  SystemIdSchema,
} from '../simulation/model/entity-components';

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
  /** Actual scoped system strength; null only when content/facts are unavailable. */
  strength: z.number().finite().nullable(),
})
  .strict()
  .readonly();
export type PlanetContactView = z.infer<typeof PlanetContactViewSchema>;

/**
 * Inspection exposes existing identity and geometry, never inferred hail access,
 * races/dialogue, current station condition or inventory. Hail access consumes
 * the separate simulation-owned standing projection in module policy.
 * A generated display name is copied only when the actor actually owns one.
 * Resolve static class and placement labels from the immutable module definition.
 */
export const SelectedContactViewSchema = z.discriminatedUnion('kind', [
  ContactIdentitySchema.extend({
    kind: z.literal('station'),
    definitionId: PositiveDefinitionIdSchema,
    stationId: StationPlacementIdSchema,
  })
    .strict()
    .readonly(),
  ContactIdentitySchema.extend({
    kind: z.literal('npc-ship'),
    displayName: z.string().min(1).nullable().default(null),
    definitionId: PositiveDefinitionIdSchema,
  })
    .strict()
    .readonly(),
]);
export type SelectedContactView = z.infer<typeof SelectedContactViewSchema>;
