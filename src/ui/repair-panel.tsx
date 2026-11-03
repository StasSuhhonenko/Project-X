/** Generic repair controls consume exactly the same capability as authored views. */
import type { GameModuleDefinition } from '../content/schemas/game-module';
import type { RepairView } from './repair-view';

export interface RepairReadoutProps {
  readonly definition: GameModuleDefinition;
  readonly playerDefinitionId: number;
  readonly repair: RepairView;
  readonly onBeginRepair: () => void;
  readonly onCancelRepair: () => void;
}

/** No store subscription or copied eligibility/payment rule belongs in this view. */
export function RepairReadout({ definition, playerDefinitionId, repair,
  onBeginRepair, onCancelRepair }: RepairReadoutProps) {
  const vessel = definition.content.entityDefinitions.find(candidate => candidate.id === playerDefinitionId
    && candidate.category === 'ship');
  if (!vessel || vessel.category !== 'ship') return null;
  const resource = definition.resources.find(candidate => candidate.id === repair.resourceId);
  return <aside className="repair-panel" aria-label="Repair controls">
    <h2>Repair service</h2>
    <p>Hull {repair.hull}/{vessel.maximumHull} · Shields {repair.shields}/{vessel.maximumShields}</p>
    {repair.repairing ? <button type="button" onClick={onCancelRepair}>Cancel repairs</button>
      : repair.cost !== null ? <button type="button" onClick={onBeginRepair}>
        Begin repairs · {repair.cost} {resource?.label ?? repair.resourceId}
      </button> : <p className="repair-unavailable">Repair service unavailable.</p>}
  </aside>;
}
