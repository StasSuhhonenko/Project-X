/** Read-only departure validation shared by UI projection and atomic travel. */
import { z } from 'zod';
import { selectPlayerEntity, type WorldState } from '../model/world-state';
import { quoteSelectedTravel, type TravelQuote, type TravelQuoteEnvironment } from './travel-quote';

export const DepartureStatusSchema = z.enum(['no-destination', 'map-geometry-unavailable', 'vessel-cannot-travel',
  'repairing', 'fuel-unavailable', 'insufficient-fuel', 'rule-refused', 'ready']);
export type DepartureStatus = z.infer<typeof DepartureStatusSchema>;

/** Does not advance calendars, allocate entities or create an arrival world. */
export function assessSelectedDeparture(world: WorldState, environment: TravelQuoteEnvironment): Readonly<{
  status: DepartureStatus; quote: TravelQuote | null; fuelBalance: number | null;
}> {
  if (world.status !== 'active') return Object.freeze({ status: 'no-destination', quote: null, fuelBalance: null });
  const player = selectPlayerEntity(world);
  if (player.condition.repairing) return Object.freeze({ status: 'repairing', quote: null, fuelBalance: null });
  const quote = quoteSelectedTravel(world, environment);
  const result = (status: DepartureStatus, fuelBalance: number | null = null) => Object.freeze({ status, quote, fuelBalance });
  if (!quote) return result('no-destination');
  if (quote.status === 'unavailable') return result(quote.reason);
  const balance = player.inventory.resources[quote.fuelResourceId] ?? null;
  if (balance === null) return result('fuel-unavailable');
  if (balance < quote.fuelUnits) return result('insufficient-fuel', balance);
  const origin = environment.systems.find(system => system.id === player.location.systemId);
  const destination = environment.systems.find(system => system.id === quote.destinationSystemId);
  if (!origin?.mapPosition || !destination?.mapPosition) throw new Error('Quoted route geometry disappeared.');
  const approved = z.boolean().parse(environment.rules.canDepart(Object.freeze({
    destinationSystemId: destination.id,
    origin: origin.mapPosition, destination: destination.mapPosition,
    estimate: Object.freeze({ durationDays: quote.durationDays, advanceDays: quote.advanceDays,
      fuelResourceId: quote.fuelResourceId, fuelUnits: quote.fuelUnits }),
    fuelBalance: balance, fuelEfficiency: environment.vessel.fuelEfficiency,
  })));
  return result(approved ? 'ready' : 'rule-refused', balance);
}
