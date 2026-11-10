/**
 * Optional module policy for where and how the player re-enters space after an
 * inter-system jump.
 *
 * Units: positions are absolute world units in the destination system; speed
 * is the player's signed per-tick speed (negative is forward, as in
 * `PlayerMotionComponent`); rotation is degrees. The policy may draw from the
 * world random stream and returns the advanced state. It runs after departure
 * progression and before the destination's entry encounter, so its draws
 * precede every entry draw.
 *
 * Omitted, the engine uses the destination's authored static `arrival`.
 */
import { z } from 'zod';
import { UInt32Schema } from '../../random/seeded-random';
import { FlightModeSchema, PositionSchema, RotationDegreesSchema } from '../model/entity-components';

export const TravelArrivalContextSchema = z
  .object({
    destinationSystemId: z.number().int().positive(),
    /** Destination planet position, absolute world units. */
    planetPosition: PositionSchema,
    /** Active vessel's maximum forward speed, positive world units per tick. */
    maximumSpeedPerFrame: z.number().finite().nonnegative(),
    /** Retained camera zoom denominator. */
    cameraZoom: z.number().finite().positive(),
    randomState: UInt32Schema,
  })
  .strict()
  .readonly();
export type TravelArrivalContext = z.infer<typeof TravelArrivalContextSchema>;

export const TravelArrivalResultSchema = z
  .object({
    position: PositionSchema,
    rotationDegrees: RotationDegreesSchema,
    speedPerFrame: z.number().finite().max(0),
    flightMode: FlightModeSchema,
    randomState: UInt32Schema,
  })
  .strict()
  .readonly();
export type TravelArrivalResult = z.infer<typeof TravelArrivalResultSchema>;

export type TravelArrivalRule = (context: TravelArrivalContext) => TravelArrivalResult;
