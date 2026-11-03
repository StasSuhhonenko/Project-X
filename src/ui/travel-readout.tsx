/** Independent journey presentation; acknowledgment cannot finish host loading. */
import type { GameModuleDefinition } from '../content/schemas/game-module';
import type { RoutePhase } from './route-view';
import type { TravelPresentationView } from './travel-presentation-view';

export function TravelReadout({ definition, travel, routePhase, onDismissTravel }: {
  readonly definition: GameModuleDefinition;
  readonly travel: TravelPresentationView | null;
  readonly routePhase: RoutePhase;
  readonly onDismissTravel: () => void;
}) {
  if (!travel) return null;
  const destination = definition.systems.find(system => system.id === travel.destinationSystemId)?.name;
  if (routePhase !== 'ready') return <aside aria-label="Journey" role="status">
    <p>{routePhase === 'loading' ? 'Preparing departure' : 'Opening destination'}: {destination}</p>
  </aside>;
  const fuelLabel = definition.resources.find(resource => resource.id === travel.fuelResourceId)?.label;
  return <aside aria-label="Arrival summary">
    <h2>Arrived at {destination}</h2>
    <p>{travel.advanceDays} days elapsed. Date: {travel.arrivalDate.major}.{travel.arrivalDate.minor}.</p>
    <p>Fuel used: {travel.fuelUnits} {fuelLabel}.</p>
    <button type="button" onClick={onDismissTravel}>Continue journey</button>
  </aside>;
}
