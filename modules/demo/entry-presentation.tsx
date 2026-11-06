/** Independently authored demonstration entry, using reusable host controls. */
import { useState } from 'react';
import type { PlayerIdentity } from '@engine/simulation/model/player-identity';
import type { EntryPresentationProps } from '@engine/ui/entry-presentation';
import { MainMenu } from '@engine/ui/main-menu';

/** Keep the demo's existing layout and explicit start/browser-save choices. */
export function EntryPresentation({ definition, onStart, saveTools }: EntryPresentationProps) {
  const [identity, setIdentity] = useState<PlayerIdentity | null>(() => definition.starts[0]?.player.identity ?? null);
  const edit = (field: keyof PlayerIdentity, value: string) => {
    setIdentity(current => (current ? Object.freeze({ ...current, [field]: value }) : null));
  };
  return (
    <>
      {identity && (
        <fieldset className="identity-editor" aria-label="Flight identity">
          <legend>Flight identity</legend>
          <label>
            Captain{' '}
            <input
              aria-label="Captain name"
              value={identity.captainName}
              onChange={event => edit('captainName', event.currentTarget.value)}
            />
          </label>
          <label>
            Vessel{' '}
            <input
              aria-label="Ship name"
              value={identity.shipName}
              onChange={event => edit('shipName', event.currentTarget.value)}
            />
          </label>
          <label>
            Organization{' '}
            <input
              aria-label="Government name"
              value={identity.governmentName}
              onChange={event => edit('governmentName', event.currentTarget.value)}
            />
          </label>
        </fieldset>
      )}
      <MainMenu definition={definition} onStart={startId => onStart(startId, identity ?? undefined)} />
      {saveTools}
    </>
  );
}
