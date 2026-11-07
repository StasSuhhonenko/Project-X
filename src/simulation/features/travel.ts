/** Atomic system transition after the selected module approves a route. */
import { z } from 'zod';
import type { LifecycleDefinition } from '../../content/schemas/lifecycle-content';
import { CalendarDateSchema, type CalendarDate } from '../model/entity-components';
import type { ProgressionDefinition } from '../model/progression-state';
import { createSystemSpatialEntities } from '../model/world-construction';
import { parseWorldState, selectPlayerEntity, type WorldState } from '../model/world-state';
import { assessSelectedDeparture } from './departure-readiness';
import { resolveProgression } from './progression';
import type { TravelQuoteEnvironment } from './travel-quote';

export interface TravelEnvironment extends TravelQuoteEnvironment {
  readonly progression?: ProgressionDefinition | undefined;
  /** Calendar days in one major unit, validated by the selected module schema. */
  readonly daysPerMajor: number;
  readonly lifecycle?: LifecycleDefinition | undefined;
}

/** Normalize calendar carry for any nonnegative trip length. Minor is one-based. */
export function advanceCalendarDate(date: CalendarDate, days: number, daysPerMajor: number): CalendarDate {
  CalendarDateSchema.parse(date);
  z.number().int().nonnegative().parse(days);
  z.number().int().positive().parse(daysPerMajor);
  if (date.minor > daysPerMajor) throw new Error('Current date exceeds module calendar period.');
  const dayOffset = date.minor - 1 + days;
  const major = date.major + Math.floor(dayOffset / daysPerMajor);
  const minor = (dayOffset % daysPerMajor) + 1;
  return Object.freeze(CalendarDateSchema.parse({ major, minor }));
}

/** Invalid/unavailable departure preserves the exact input world reference. */
export function travelToSelectedDestination(world: WorldState, environment: TravelEnvironment): WorldState {
  const assessment = assessSelectedDeparture(world, environment);
  const { quote, fuelBalance: balance } = assessment;
  if (assessment.status !== 'ready' || !quote || quote.status !== 'estimated' || balance === null) return world;
  const player = selectPlayerEntity(world);
  const destination = environment.systems.find(system => system.id === quote.destinationSystemId);
  if (!destination) throw new Error('Approved destination disappeared.');

  const date = advanceCalendarDate(world.date, quote.advanceDays, environment.daysPerMajor);
  const spatial = createSystemSpatialEntities(
    destination,
    world.nextEntitySequence,
    environment.lifecycle,
    world.lifecycle
  );
  const arrival = destination.arrival;
  const arrivedPlayer = {
    ...player,
    location: { systemId: destination.id, position: arrival.position, rotationDegrees: arrival.rotationDegrees },
    motion: { speedPerFrame: arrival.speedPerFrame, flightMode: arrival.flightMode },
    inventory: {
      ...player.inventory,
      resources: {
        ...player.inventory.resources,
        [quote.fuelResourceId]: balance - quote.fuelUnits,
      },
    },
  };
  // Replacing the active-system entity set is one publication. Old NPCs and
  // target references leave together; IDs continue from the allocator.
  const progressed = resolveProgression(world, environment.rules, environment.progression, {
    kind: 'travel-departure',
    originSystemId: player.location.systemId,
    destinationSystemId: destination.id,
  });
  return parseWorldState({
    ...progressed,
    missions: null,
    date,
    projectiles: [],
    specialEffects: [],
    specialActorSlots: spatial.stationSpawnSlots ?? [null, ...spatial.stations.map(station => station.id)],
    nextEntitySequence: spatial.nextEntitySequence,
    selectedTargetEntityId: null,
    selectedDestinationSystemId: null,
    lifecycle: {
      ...world.lifecycle,
      stationSpawnSlots: spatial.stationSpawnSlots,
      activeStationVisit: spatial.activeStationVisit,
    },
    entities: [arrivedPlayer, spatial.planet, ...spatial.stations],
  });
}
