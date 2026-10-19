/** React command surface for the active module's planet repair service. */
import type { GameModule } from '../content/game-module';
import { useAppStore } from '../app/app-store-context';
import { quotePlayerRepair } from '../simulation/features/repair';
import { selectPlayerEntity } from '../simulation/model/world-state';

export function RepairPanel({ gameModule }: { readonly gameModule: GameModule }) {
  const world = useAppStore(state => state.world);
  const beginRepair = useAppStore(state => state.beginRepair);
  const cancelRepair = useAppStore(state => state.cancelRepair);
  if (!world || world.status !== 'active') return null;
  const player = selectPlayerEntity(world);
  const vessel = gameModule.catalog.getShipDefinition(player.definitionId);
  const system = gameModule.definition.systems.find(candidate => candidate.id === player.location.systemId);
  if (!vessel || !system) return null;

  const offer = player.condition.repairing ? null
    : quotePlayerRepair(world, { vessel, system, rules: gameModule.rules });
  const resource = offer
    ? gameModule.definition.resources.find(candidate => candidate.id === offer.resourceId) : null;

  return (
    <aside className="repair-panel" aria-label="Repair controls">
      <h2>Repair service</h2>
      <p>Hull {player.condition.hull}/{vessel.maximumHull} · Shields {player.condition.shields}/{vessel.maximumShields}</p>
      {player.condition.repairing ? (
        <button type="button" onClick={cancelRepair}>Cancel repairs</button>
      ) : offer ? (
        <button type="button" onClick={beginRepair}>
          Begin repairs · {offer.cost} {resource?.label ?? offer.resourceId}
        </button>
      ) : (
        <p className="repair-unavailable">Repair service unavailable.</p>
      )}
    </aside>
  );
}
