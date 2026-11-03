/** Neutral map facts and simulation-owned departure readiness. */
import { z } from 'zod';
import { TravelQuoteSchema } from '../simulation/features/travel-quote';
import { DepartureStatusSchema } from '../simulation/features/departure-readiness';

const DestinationSchema = z.object({
  systemId: z.number().int().positive(), name: z.string().min(1),
  mapPosition: z.object({ x: z.number().finite(), y: z.number().finite(),
    status: z.enum(['authored', 'verified', 'provisional']) }).strict().readonly().nullable(),
  quote: TravelQuoteSchema.nullable(),
}).strict().readonly();
export const RoutePhaseSchema = z.enum(['ready', 'loading', 'arriving']);
export type RoutePhase = z.infer<typeof RoutePhaseSchema>;
export const RouteErrorKindSchema = z.enum(['departure', 'assets', 'view']);
export type RouteErrorKind = z.infer<typeof RouteErrorKindSchema>;
export const RouteViewSchema = z.object({
  systemId: z.number().int().positive(), currentSystemName: z.string().min(1),
  destinations: z.array(DestinationSchema).readonly(),
  destinationSystemId: z.number().int().positive().nullable(), destinationName: z.string().min(1).nullable(),
  quote: TravelQuoteSchema.nullable(), fuelBalance: z.number().finite().nonnegative().nullable(),
  fuelLabel: z.string().min(1).nullable(),
  departureStatus: DepartureStatusSchema,
}).strict().readonly();
export type RouteView = z.infer<typeof RouteViewSchema>;
