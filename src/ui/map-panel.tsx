/** Independent generic map rendering; policies and services remain in the host. */
import type { RoutePhase, RouteView } from './route-view';

export function MapReadout({
  route,
  routePhase,
  routeError,
  onSelectDestination,
  onDepart,
}: {
  readonly route: RouteView | null;
  readonly routePhase: RoutePhase;
  readonly routeError: string | null;
  readonly onSelectDestination: (systemId: number | null) => void;
  readonly onDepart: () => void;
}) {
  if (!route) return null;
  const busy = routePhase !== 'ready';
  const quote = route.quote;
  const refusals: Partial<Record<RouteView['departureStatus'], string>> = {
    'map-geometry-unavailable': 'Travel estimate unavailable: map positions have not been established.',
    'vessel-cannot-travel': 'Travel unavailable for this vessel.',
    repairing: 'Departure unavailable while repairs are active.',
    'fuel-unavailable': 'Travel fuel reserve is unavailable.',
    'insufficient-fuel': 'Insufficient travel fuel.',
    'rule-refused': 'Departure refused by the current route and fuel reserve rules.',
  };
  return (
    <aside className="map-panel" aria-label="System map">
      <h2>System map</h2>
      <p>Current system: {route.currentSystemName}</p>
      <div className="map-destinations">
        {route.destinations
          .filter(system => system.systemId !== route.systemId)
          .map(system => (
            <button
              key={system.systemId}
              type="button"
              disabled={busy}
              aria-pressed={route.destinationSystemId === system.systemId}
              onClick={() => onSelectDestination(system.systemId)}
            >
              {system.name}
            </button>
          ))}
      </div>
      {route.destinationName && <p>Selected destination: {route.destinationName}</p>}
      {quote?.status === 'estimated' && (
        <p>
          Estimated travel: {quote.durationDays} days · {quote.fuelUnits} {route.fuelLabel}
          {quote.routeEvidence === 'provisional' ? ' (provisional map positions)' : ''}.
        </p>
      )}
      {refusals[route.departureStatus] && <p>{refusals[route.departureStatus]}</p>}
      {route.destinationSystemId !== null && (
        <>
          <button type="button" disabled={busy || route.departureStatus !== 'ready'} onClick={onDepart}>
            Depart
          </button>
          <button type="button" disabled={busy} onClick={() => onSelectDestination(null)}>
            Clear destination
          </button>
        </>
      )}
      {busy && <p role="status">Loading destination…</p>}
      {routeError && <p role="alert">{routeError}</p>}
    </aside>
  );
}
