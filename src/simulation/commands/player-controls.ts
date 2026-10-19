/** Input intent sampled once per fixed simulation frame. */
import { z } from 'zod';

/**
 * Commands are validated at external boundaries and inferred from this schema.
 * Keyboard input already constructs booleans, while future gamepad, replay, or
 * network adapters can use the same contract without duplicating its shape.
 */
export const PlayerControlsSchema = z.object({
  accelerate: z.boolean(),
  decelerate: z.boolean(),
  turnLeft: z.boolean(),
  turnRight: z.boolean(),
  zoomOut: z.boolean().optional(),
  zoomIn: z.boolean().optional(),
  /** Held primary-fire input; sampled once per fixed tick. */
  firePrimary: z.boolean().optional(),
}).strict().readonly();

export type PlayerControls = z.infer<typeof PlayerControlsSchema>;

export const IDLE_PLAYER_CONTROLS: PlayerControls = Object.freeze({
  accelerate: false,
  decelerate: false,
  turnLeft: false,
  turnRight: false,
  zoomOut: false,
  zoomIn: false,
  firePrimary: false,
});
