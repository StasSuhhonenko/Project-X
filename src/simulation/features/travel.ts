/** Atomic system transition after the selected module approves a route. */
import { z } from 'zod';
import { CalendarDateSchema, type CalendarDate } from '../model/entity-components';
import { createSystemSpatialEntities } from '../model/world-construction';
import { parseWorldState, selectPlayerEntity, type WorldState } from '../model/world-state';
import { quoteSelectedTravel, type TravelQuoteEnvironment } from './travel-quote';

export interface TravelEnvironment extends TravelQuoteEnvironment {
  /** Calendar days in one major unit, validated by the selected module schema. */
  readonly daysPerMajor: number;
}

/** Normalize calendar carry for any nonnegative trip length. Minor is one-based. */
export function advanceCalendarDate(date: CalendarDate, days: number, daysPerMajor: number): CalendarDate {
  CalendarDateSchema.parse(date);
  z.number().int().nonnegative().parse(days);
  z.number().int().positive().parse(daysPerMajor);
  if (date.minor > daysPerMajor) throw new Error('Current date exceeds module calendar period.');
  const dayOffset = date.minor - 1 + days;
  const major = date.major + Math.floor(dayOffset / daysPerMajor);
  const minor = dayOffset % daysPerMajor + 1;
  return Object.freeze(CalendarDateSchema.parse({ major, minor }));
}

/** Invalid/unavailable departure preserves the exact input world reference. */
export function travelToSelectedDestination(world: WorldState, environment: TravelEnvironment): WorldState {
  if (world.status !== 'active' || world.selectedDestinationSystemId === null) return world;
  const player = selectPlayerEntity(world);
  if (player.condition.repairing) return world;
  const quote = quoteSelectedTravel(world, environment);
  if (!quote || quote.status !== 'estimated') return world;
  const balance = player.inventory.resources[quote.fuelResourceId];
  if (balance === undefined || balance < quote.fuelUnits) return world;
  const origin = environment.systems.find(system => system.id === player.location.systemId);
  const destination = environment.systems.find(system => system.id === quote.destinationSystemId);
  if (!origin?.mapPosition || !destination?.mapPosition) throw new Error('Quoted route geometry disappeared.');
  const approved = z.boolean().parse(environment.rules.canDepart(Object.freeze({
    origin: origin.mapPosition, destination: destination.mapPosition,
    estimate: Object.freeze({ durationDays: quote.durationDays, advanceDays: quote.advanceDays,
      fuelResourceId: quote.fuelResourceId, fuelUnits: quote.fuelUnits }),
    fuelBalance: balance, fuelEfficiency: environment.vessel.fuelEfficiency,
  })));
  if (!approved) return world;

  const date = advanceCalendarDate(world.date, quote.advanceDays, environment.daysPerMajor);
  const spatial = createSystemSpatialEntities(destination, world.nextEntitySequence);
  const arrival = destination.arrival;
  const arrivedPlayer = {
    ...player,
    location: { systemId: destination.id, position: arrival.position, rotationDegrees: arrival.rotationDegrees },
    motion: { speedPerFrame: arrival.speedPerFrame, flightMode: arrival.flightMode },
    inventory: { ...player.inventory, resources: {
      ...player.inventory.resources,
      [quote.fuelResourceId]: balance - quote.fuelUnits,
    } },
  };
  // Replacing the active-system entity set is one publication. Old NPCs and
  // target references leave together; IDs continue from the allocator.
  return parseWorldState({
    ...world,
    date,
    nextEntitySequence: spatial.nextEntitySequence,
    selectedTargetEntityId: null,
    selectedDestinationSystemId: null,
    entities: [arrivedPlayer, spatial.planet, ...spatial.stations],
  });
}
