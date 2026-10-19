/** Read-only destination estimate; S16 will own departure eligibility and commit. */
import { z } from 'zod';
import type { ShipDefinition } from '../../content/schemas/game-content';
import type { SystemDefinition } from '../../content/schemas/game-module';
import type { GameRules } from '../contracts/game-rules';
import { selectPlayerEntity, type WorldState } from '../model/world-state';

const TravelEstimateSchema = z.object({
  durationDays: z.number().finite().nonnegative(),
  advanceDays: z.number().int().nonnegative(),
  fuelResourceId: z.string().regex(/^[a-z][a-z0-9-]*$/),
  fuelUnits: z.number().int().nonnegative(),
}).strict().readonly();

export const TravelQuoteSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('unavailable'), destinationSystemId: z.number().int().positive(), reason: z.enum(['map-geometry-unavailable', 'vessel-cannot-travel']) }).strict().readonly(),
  z.object({ status: z.literal('estimated'), destinationSystemId: z.number().int().positive(), routeEvidence: z.enum(['authored', 'verified', 'provisional']), durationDays: z.number().finite().nonnegative(), advanceDays: z.number().int().nonnegative(), fuelResourceId: z.string().regex(/^[a-z][a-z0-9-]*$/), fuelUnits: z.number().int().nonnegative() }).strict().readonly(),
]);
export type TravelQuote = z.infer<typeof TravelQuoteSchema>;

export interface TravelQuoteEnvironment {
  readonly systems: readonly SystemDefinition[];
  readonly vessel: ShipDefinition;
  readonly resourceIds: readonly string[];
  readonly rules: GameRules;
}

/** A null result means no selection; missing geometry is an explicit quote result. */
export function quoteSelectedTravel(world: WorldState, environment: TravelQuoteEnvironment): TravelQuote | null {
  if (world.status !== 'active' || world.selectedDestinationSystemId === null) return null;
  const player = selectPlayerEntity(world);
  const origin = environment.systems.find(system => system.id === player.location.systemId);
  const destination = environment.systems.find(system => system.id === world.selectedDestinationSystemId);
  if (!origin || !destination || origin.id === destination.id) throw new Error('Selected route does not resolve to distinct systems.');
  if (environment.vessel.fuelEfficiency <= 0) return Object.freeze({
    status: 'unavailable', destinationSystemId: destination.id, reason: 'vessel-cannot-travel',
  });
  if (!origin.mapPosition || !destination.mapPosition) return Object.freeze({
    status: 'unavailable', destinationSystemId: destination.id, reason: 'map-geometry-unavailable',
  });
  const estimate = TravelEstimateSchema.parse(environment.rules.estimateTravel(Object.freeze({
    origin: origin.mapPosition, destination: destination.mapPosition,
    vessel: Object.freeze({ fuelEfficiency: environment.vessel.fuelEfficiency }),
  })));
  if (!environment.resourceIds.includes(estimate.fuelResourceId)) throw new Error('Travel rule quoted an undeclared resource.');
  const routeEvidence = origin.mapPosition.status === 'provisional' || destination.mapPosition.status === 'provisional'
    ? 'provisional' : origin.mapPosition.status === 'verified' && destination.mapPosition.status === 'verified'
      ? 'verified' : 'authored';
  return Object.freeze(TravelQuoteSchema.parse({ status: 'estimated', destinationSystemId: destination.id, routeEvidence, ...estimate }));
}
