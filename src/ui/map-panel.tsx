/** React route selection from validated systems and simulation-owned quote. */
import type { GameModule } from '../content/game-module';
import { useAppStore } from '../app/app-store-context';
import { quoteSelectedTravel } from '../simulation/features/travel-quote';
import { selectPlayerEntity } from '../simulation/model/world-state';

export function MapPanel({ gameModule, onDepart, departing = false, error = null }: {
  readonly gameModule: GameModule;
  readonly onDepart?: () => void;
  readonly departing?: boolean;
  readonly error?: string | null;
}) {
  const world = useAppStore(state => state.world);
  const selectDestination = useAppStore(state => state.selectDestination);
  if (!world || world.status !== 'active') return null;
  const player = selectPlayerEntity(world);
  const vessel = gameModule.catalog.getShipDefinition(player.definitionId);
  if (!vessel) throw new Error('Active map vessel definition is unavailable.');
  const systems = gameModule.definition.systems;
  const current = systems.find(system => system.id === player.location.systemId);
  if (!current) throw new Error('Active map system definition is unavailable.');
  const destination = systems.find(system => system.id === world.selectedDestinationSystemId);
  const quote = quoteSelectedTravel(world, {
    systems, vessel, rules: gameModule.rules,
    resourceIds: gameModule.definition.resources.map(resource => resource.id),
  });
  const fuelLabel = quote?.status === 'estimated'
    ? gameModule.definition.resources.find(resource => resource.id === quote.fuelResourceId)?.label ?? quote.fuelResourceId
    : null;
  return <aside className="map-panel" aria-label="System map">
    <h2>System map</h2>
    <p>Current system: {current.name}</p>
    <div className="map-destinations">
      {systems.filter(system => system.id !== current.id).map(system => <button key={system.id}
        type="button" aria-pressed={world.selectedDestinationSystemId === system.id}
        onClick={() => selectDestination({ destinationSystemId: system.id })}>{system.name}</button>)}
    </div>
    {destination && <p>Selected destination: {destination.name}</p>}
    {quote?.status === 'unavailable' && <p>{quote.reason === 'vessel-cannot-travel'
      ? 'Travel unavailable for this vessel.'
      : 'Travel estimate unavailable: map positions have not been established.'}</p>}
    {quote?.status === 'estimated' && <p>Estimated travel: {quote.durationDays} days · {quote.fuelUnits} {fuelLabel}{quote.routeEvidence === 'provisional' ? ' (provisional map positions)' : ''}.</p>}
    {quote?.status === 'estimated' && onDepart && <button type="button" disabled={departing} onClick={onDepart}>Depart</button>}
    {departing && <p role="status">Loading destination…</p>}
    {error && <p role="alert">{error}</p>}
    {destination && <button type="button" disabled={departing} onClick={() => selectDestination({ destinationSystemId: null })}>Clear destination</button>}
  </aside>;
}
