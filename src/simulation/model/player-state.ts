/** Validated player-start DTO and the narrow state consumed by movement rules. */
import { z } from 'zod';
import {
  FlightModeSchema,
  NonNegativeNumberSchema,
  PlayerNoticeSchema,
  PlayerSpeedPerFrameSchema,
  PositionSchema,
  PositiveDefinitionIdSchema,
  RepairingSchema,
  ResourceBalancesSchema,
  RotationDegreesSchema,
  SystemIdSchema,
} from './entity-components';

/**
 * Module-authored start data. This flat JSON boundary is converted into runtime
 * components once; it is not a second authoritative representation during play.
 */
export const StartingPlayerSchema = z.object({
  entityDefinitionId: PositiveDefinitionIdSchema,
  systemId: SystemIdSchema,
  position: PositionSchema,
  rotationDegrees: RotationDegreesSchema,
  speedPerFrame: PlayerSpeedPerFrameSchema,
  flightMode: FlightModeSchema.default('impulse'),
  hull: NonNegativeNumberSchema,
  shields: NonNegativeNumberSchema,
  energy: NonNegativeNumberSchema,
  notice: PlayerNoticeSchema.nullable().default(null),
  resources: ResourceBalancesSchema,
  repairing: RepairingSchema,
}).strict().readonly();
export type StartingPlayer = z.infer<typeof StartingPlayerSchema>;

/**
 * Focused read/update model for navigation and its energy/notice side effects.
 * Identity, system, durability, inventory and equipment cannot be replaced
 * through this contract because they are not present.
 */
export const PlayerMovementStateSchema = z.object({
  position: PositionSchema,
  rotationDegrees: RotationDegreesSchema,
  speedPerFrame: PlayerSpeedPerFrameSchema,
  flightMode: FlightModeSchema,
  energy: NonNegativeNumberSchema,
  repairing: RepairingSchema,
  notice: PlayerNoticeSchema.nullable(),
}).strict().readonly();
export type PlayerMovementState = z.infer<typeof PlayerMovementStateSchema>;

/** Parse test/external input and freeze the complete focused view. */
export function parsePlayerMovementState(input: unknown): PlayerMovementState {
  return freezePlayerMovementState(PlayerMovementStateSchema.parse(input));
}

/** Seal trusted rule output before another feature consumes it. */
export function freezePlayerMovementState(player: PlayerMovementState): PlayerMovementState {
  Object.freeze(player.position);
  if (player.notice) Object.freeze(player.notice);
  return Object.freeze(player);
}
