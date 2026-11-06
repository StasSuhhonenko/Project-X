/** BM1 map quote policy recovered from Symbol 3 map and Page 1 travel handlers. */
import type {
  TravelDepartureContext,
  TravelEstimate,
  TravelEstimateContext,
} from '@engine/simulation/contracts/game-rules';
import { getTravelRestriction } from './travel-restrictions';

const MAP_UNITS_PER_DAY = 5; // Page-1-25841.as initializes `_root.maxwarp` to 5.

/** The map displays raw duration; departure later floors days and fuel use. */
export function estimateTravel(context: TravelEstimateContext): TravelEstimate {
  const distance =
    Math.abs(context.origin.x - context.destination.x) + Math.abs(context.origin.y - context.destination.y);
  const durationDays = distance / MAP_UNITS_PER_DAY;
  const departureDays = Math.floor(durationDays);
  const fuelUnits = Math.floor(departureDays / context.vessel.fuelEfficiency / 3);
  return Object.freeze({ durationDays, advanceDays: departureDays, fuelResourceId: 'antimatter', fuelUnits });
}

/** Preserve `gotosystem()`'s both-axes guard and `mapclick()`'s strict fuel test. */
export function canDepart(context: TravelDepartureContext): boolean {
  if (getTravelRestriction(context.destinationSystemId)) return false;
  if (context.origin.x === context.destination.x || context.origin.y === context.destination.y) return false;
  return context.estimate.advanceDays < context.fuelBalance * 2 * context.fuelEfficiency;
}
