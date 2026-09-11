/** Serializable player state. Rendering and browser objects never enter this model. */
import { z } from 'zod';

export const PlayerStateSchema = z.object({
  entityDefinitionId: z.number().int().positive(),
  systemId: z.number().int().positive(),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }).strict().readonly(),
  rotationDegrees: z.number().finite(),
  speedPerFrame: z.number().finite().max(0),
  hull: z.number().finite().nonnegative(),
  shields: z.number().finite().nonnegative(),
  energy: z.number().finite().nonnegative(),
  // Module-local IDs, never display names. The module boundary checks that
  // these keys exactly match the declared resource definitions.
  resources: z.record(z.string().regex(/^[a-z][a-z0-9-]*$/), z.number().finite().nonnegative()).readonly(),
  repairing: z.boolean(),
}).strict().readonly();

export type PlayerState = z.infer<typeof PlayerStateSchema>;

/** Validate untrusted serializable input and freeze every nested state object. */
export function parsePlayerState(input: unknown): PlayerState {
  return freezePlayerState(PlayerStateSchema.parse(input));
}

/**
 * Seal a state produced by trusted simulation code before publication. This
 * avoids reparsing on every simulation tick while preventing mutation through a
 * retained Zustand snapshot reference.
 */
export function freezePlayerState(player: PlayerState): PlayerState {
  Object.freeze(player.position);
  Object.freeze(player.resources);
  return Object.freeze(player);
}
