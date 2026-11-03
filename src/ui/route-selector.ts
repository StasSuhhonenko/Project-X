/** Cache only route-relevant inputs; world ticks never publish new map facts. */
import type { AppStoreState } from '../app/app-store';
import type { GameModule } from '../content/game-module';
import { selectPlayerEntity } from '../simulation/model/world-state';
import { quoteSelectedTravel } from '../simulation/features/travel-quote';
import { assessSelectedDeparture } from '../simulation/features/departure-readiness';
import type { RouteView } from './route-view';

const caches = new WeakMap<GameModule, { quoteKey: string; key: string; view: RouteView }>();
export function selectRouteView(state: AppStoreState, gameModule: GameModule): RouteView | null {
  const world = state.world;
  if (state.screen !== 'game' || !world || world.status !== 'active') return null;
  const player = selectPlayerEntity(world);
  const quoteKey = JSON.stringify([player.location.systemId, player.definitionId, world.selectedDestinationSystemId]);
  const cached = caches.get(gameModule);
  const vessel = gameModule.catalog.getShipDefinition(player.definitionId);
  const current = gameModule.definition.systems.find(system => system.id === player.location.systemId);
  if (!vessel || !current) throw new Error('Active route definitions are unavailable.');
  const environment = { systems: gameModule.definition.systems, vessel, rules: gameModule.rules,
    resourceIds: gameModule.definition.resources.map(resource => resource.id),
    daysPerMajor: gameModule.definition.calendar.daysPerMajor };
  const quote = cached?.quoteKey === quoteKey ? cached.view.quote : quoteSelectedTravel(world, environment);
  const fuelBalance = quote?.status === 'estimated' ? player.inventory.resources[quote.fuelResourceId] ?? null : null;
  const key = JSON.stringify([quoteKey, player.condition.repairing, fuelBalance]);
  if (cached?.key === key) return cached.view;
  const departureStatus = assessSelectedDeparture(world, environment).status;
  const view: RouteView = Object.freeze({
    systemId: current.id, currentSystemName: current.name,
    destinations: Object.freeze(gameModule.definition.systems.map(system => Object.freeze({
      systemId: system.id, name: system.name,
      mapPosition: system.mapPosition ? Object.freeze({ ...system.mapPosition }) : null,
      quote: system.id === current.id ? null : system.id === world.selectedDestinationSystemId ? quote
        : quoteSelectedTravel({ ...world, selectedDestinationSystemId: system.id }, environment),
    }))),
    destinationSystemId: world.selectedDestinationSystemId,
    destinationName: gameModule.definition.systems.find(system => system.id === world.selectedDestinationSystemId)?.name ?? null,
    quote, fuelBalance,
    fuelLabel: quote?.status === 'estimated'
      ? gameModule.definition.resources.find(resource => resource.id === quote.fuelResourceId)?.label ?? quote.fuelResourceId : null,
    departureStatus,
  });
  caches.set(gameModule, { quoteKey, key, view });
  return view;
}
