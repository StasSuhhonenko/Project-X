/** Independent, native inspection controls for modules without authored contacts. */
import type { GameModuleDefinition } from '../content/schemas/game-module';
import type { PlanetContactView, SelectedContactView } from './contact-view';

/**
 * Native details owns temporary open/close state. Identity keys replace that node
 * when a contact changes, so a removed/replaced target cannot reopen stale text.
 * This inspects facts only; it dispatches no hail, transaction or selection command.
 */
export function ContactReadout({ definition, planetContact, selectedContact }: {
  readonly definition: GameModuleDefinition;
  readonly planetContact: PlanetContactView | null;
  readonly selectedContact: SelectedContactView | null;
}) {
  const system = planetContact
    ? definition.systems.find(candidate => candidate.id === planetContact.systemId) : null;
  const selectedSystem = selectedContact
    ? definition.systems.find(candidate => candidate.id === selectedContact.systemId) : null;
  const placement = selectedContact?.kind === 'station'
    ? selectedSystem?.stations.find(candidate => candidate.id === selectedContact.stationId) : null;
  const entity = selectedContact
    ? definition.content.entityDefinitions.find(candidate => candidate.id === selectedContact.definitionId) : null;
  if (planetContact && !system) throw new Error(`Contact system ${planetContact.systemId} is missing content.`);
  if (selectedContact && (!entity || (selectedContact.kind === 'station' && !placement))) {
    throw new Error(`Contact ${selectedContact.id} is missing content.`);
  }
  return <section className="contact-readout" aria-label="Contact inspection" data-game-input="blocked">
    {planetContact && system && <details key={planetContact.id}>
      <summary>Inspect planet contact</summary>
      <h2>{system.name}</h2>
      <p>{system.planet.description}</p>
      <p>Relative position: {planetContact.relativeX.toFixed(1)}, {planetContact.relativeY.toFixed(1)}</p>
    </details>}
    {selectedContact && entity && <details key={`${selectedContact.kind}/${selectedContact.id}`}>
      <summary>Inspect selected contact</summary>
      <h2>{placement?.name ?? entity.name}</h2>
      <p>{entity.description}</p>
      <p>Relative position: {selectedContact.relativeX.toFixed(1)}, {selectedContact.relativeY.toFixed(1)}</p>
    </details>}
  </section>;
}
