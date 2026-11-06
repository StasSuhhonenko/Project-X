/** Transient host-owned journey facts; never persisted or writable by modules. */
import { z } from 'zod';
import { CalendarDateSchema } from '../simulation/model/entity-components';
import { PlayerSpatialViewSchema } from './player-spatial-view';

export const TravelPresentationOptionsSchema = z.object({
  /** Minimum visible departure time. Asset loading may take longer. */
  departureDurationMs: z.number().finite().nonnegative().max(60_000),
  /** Authored actor overlay replaces only the normal player, retaining the world. */
  hidePlayerDuringDeparture: z.boolean().optional(),
}).strict().readonly();
export type TravelPresentationOptions = z.infer<typeof TravelPresentationOptionsSchema>;

export const TravelPresentationViewSchema = z.object({
  operationId: z.number().int().positive(),
  /** Monotonic performance.now() epoch, allowing a system remount to keep time. */
  departureStartedAtMs: z.number().finite().nonnegative(),
  originSystemId: z.number().int().positive(),
  destinationSystemId: z.number().int().positive(),
  playerDefinitionId: z.number().int().positive(),
  originSpatial: PlayerSpatialViewSchema.nullable(),
  durationDays: z.number().finite().nonnegative(),
  advanceDays: z.number().int().nonnegative(),
  fuelResourceId: z.string().min(1),
  fuelUnits: z.number().finite().nonnegative(),
  arrivalDate: CalendarDateSchema.readonly(),
}).strict().readonly();
export type TravelPresentationView = z.infer<typeof TravelPresentationViewSchema>;
