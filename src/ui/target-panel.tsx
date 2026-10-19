/** Read-only details for the one world-owned selected target. */
import { useShallow } from 'zustand/react/shallow';
import type { AppStoreState } from '../app/app-store';
import { useAppStore } from '../app/app-store-context';
import type { GameModuleDefinition } from '../content/schemas/game-module';
import { selectSelectedTargetView } from './selected-target-selector';
import type { SelectedTargetView } from './selected-target-view';

type IdentityDetails<T> = T extends SelectedTargetView ? Omit<T, 'relativeX' | 'relativeY'> : never;
export type TargetPanelView = IdentityDetails<SelectedTargetView>;

/** Select stable identity/content keys; movement is irrelevant to this panel. */
export function selectTargetPanelView(state: AppStoreState): TargetPanelView | null {
  const target = selectSelectedTargetView(state);
  if (!target) return null;
  if (target.kind === 'npc-ship') {
    return Object.freeze({ kind: target.kind, id: target.id, definitionId: target.definitionId, systemId: target.systemId,
      hull: target.hull, shields: target.shields });
  }
  return Object.freeze({
    kind: target.kind,
    id: target.id,
    definitionId: target.definitionId,
    stationId: target.stationId,
    systemId: target.systemId,
  });
}

export function TargetPanel({ definition }: { readonly definition: GameModuleDefinition }) {
  const target = useAppStore(useShallow(selectTargetPanelView));
  return <TargetReadout definition={definition} target={target} />;
}

/** Independent generic presentation of the selected-module target capability. */
export function TargetReadout({ definition, target, onClearTarget }: {
  readonly definition: GameModuleDefinition;
  readonly target: TargetPanelView | null;
  readonly onClearTarget?: () => void;
}) {
  if (!target) return null;
  if (target.kind === 'npc-ship') {
    const ship = definition.content.entityDefinitions.find(candidate => candidate.id === target.definitionId);
    if (!ship) throw new Error(`Selected NPC ${target.id} is missing content.`);
    return (
      <section className="target-panel" aria-label="Selected target">
        <h2>{ship.name}</h2>
        <p>{target.id}</p>
        <div><span>Hull</span><strong>{target.hull}</strong></div>
        <div><span>Shields</span><strong>{target.shields}</strong></div>
        {onClearTarget && <button type="button" onClick={onClearTarget}>Clear target</button>}
      </section>
    );
  }

  const system = definition.systems.find(candidate => candidate.id === target.systemId);
  const placement = system?.stations.find(candidate => candidate.id === target.stationId);
  const structure = definition.content.entityDefinitions.find(candidate => candidate.id === target.definitionId);
  if (!placement || !structure) throw new Error(`Selected station ${target.stationId} is missing content.`);
  return (
    <section className="target-panel" aria-label="Selected target">
      <h2>{placement.name}</h2>
      <p>{structure.name} · {target.id}</p>
      {onClearTarget && <button type="button" onClick={onClearTarget}>Clear target</button>}
    </section>
  );
}
