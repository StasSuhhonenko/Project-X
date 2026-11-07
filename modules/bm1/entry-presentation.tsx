/** BM1's bounded entry presentation. The host owns validated world commits and
 * browser saves; this component owns only route/selection and authored ink.
 * Source-only mechanics remain visibly unavailable until their owning commands
 * exist. SVG planes are reviewed local assets, not interpreted recovery data. */
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { EntryPresentationProps } from '@engine/ui/entry-presentation';
import { EditableSourceInput, hasUnsupportedSourceGlyph } from './ui/entry/editable-source-input';
import { createEditableStartController, editableStartFields, type EditableStartDraft } from './ui/entry/editable-start';
import { entryAsset, entryContent, type EntryControl } from './ui/entry/entry-content';
import { createEntryController, entryStartRequest } from './ui/entry/entry-controller';
import { entryArtworkAssets, entryScene } from './ui/entry/entry-scenes';
import { SourceControl } from './ui/source-control';
import { useArtwork } from './ui/use-artwork';
import './ui/entry/entry.css';

const menuRoutes = { menu1: 'start', menu2: 'instructions', menu3: 'saved', menu4: 'options' } as const;
const menuLabels = { menu1: 'New Game', menu2: 'Instructions', menu3: 'Play Saved', menu4: 'Options' } as const;

/** Computed once: the module client holds the same set for the page lifetime. */
const preparedEntryAssets = entryArtworkAssets();

export function EntryPresentation({ definition, onStart, saveTools, onPrepared }: EntryPresentationProps) {
  const controller = useMemo(createEntryController, []);
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const drafts = useMemo(createEditableStartController, []);
  const draft = useSyncExternalStore(drafts.subscribe, drafts.getSnapshot);
  // Every route and variant is prepared before the first reveal and retained for
  // the page, so route changes and Return to menu never pass through a loading
  // render. One boot status covers the initial preparation only.
  const artwork = useArtwork(preparedEntryAssets);
  const assetStatus = artwork.ready;
  const { plane, file } = entryScene(view);
  const reported = useRef(false);
  useEffect(() => {
    if (assetStatus !== 'ready' || reported.current) return;
    reported.current = true;
    onPrepared?.();
  }, [assetStatus, onPrepared]);

  const action = (
    control: EntryControl
  ): { label: string; activate?: (release: { readonly shiftKey: boolean }) => void; disabled?: boolean } => {
    if (view.route === 'menu') {
      const name = Object.keys(menuRoutes).find(name => name === control.name) as keyof typeof menuRoutes | undefined;
      if (!name) throw new Error('Unrecognized reviewed main menu control');
      return { label: menuLabels[name], activate: () => controller.open(menuRoutes[name]) };
    }
    if ([2766, 7973, 12398, 21657, 37628].includes(control.scriptOffset))
      return { label: 'Return', activate: controller.return };
    if (view.route === 'options' && control.scriptOffset === 3069)
      return { label: 'Keys', activate: () => controller.open('keys') };
    if (view.route === 'start' && control.scriptOffset === 21929)
      return {
        label: 'Non-Aligned Humanoid',
        activate: release => {
          controller.selectRelease({ selection: 'neutral', shiftKey: release.shiftKey });
        },
      };
    if (view.route === 'start' && control.scriptOffset === 23310)
      return {
        label: 'Earth Officer',
        activate: release => {
          controller.selectRelease({ selection: 'earth', shiftKey: release.shiftKey });
        },
      };
    if (view.route === 'start' && control.scriptOffset === 34893)
      return {
        label: 'Borg (Shift at release)',
        activate: release => {
          controller.selectRelease({ selection: 'borg', shiftKey: release.shiftKey });
        },
      };
    if (view.route === 'start' && control.scriptOffset === 33627)
      return {
        label: 'Dominion Soldier (Shift at release)',
        activate: release => {
          controller.selectRelease({ selection: 'dominion', shiftKey: release.shiftKey });
        },
      };
    if (view.route === 'start' && control.scriptOffset === 32492)
      return {
        label: 'Cardassian Gul (Shift at release)',
        activate: release => {
          controller.selectRelease({ selection: 'gul', shiftKey: release.shiftKey });
        },
      };
    if (view.route === 'start' && control.scriptOffset === 31255)
      return {
        label: 'Cardassian Minion',
        activate: release => {
          controller.selectRelease({ selection: 'cardassian', shiftKey: release.shiftKey });
        },
      };
    if (view.route === 'start' && control.scriptOffset === 27982)
      return {
        label: 'Romulan Soldier',
        activate: release => {
          controller.selectRelease({ selection: 'romulan', shiftKey: release.shiftKey });
        },
      };
    if (view.route === 'start' && control.scriptOffset === 26585)
      return {
        label: 'Ferengi Merchant',
        activate: release => {
          controller.selectRelease({ selection: 'ferengi', shiftKey: release.shiftKey });
        },
      };
    if (view.route === 'start' && control.scriptOffset === 25043)
      return {
        label: 'Klingon Warrior',
        activate: release => {
          controller.selectRelease({ selection: 'klingon', shiftKey: release.shiftKey });
        },
      };
    if (view.route === 'start' && control.scriptOffset === 29457)
      return {
        label: 'Vulcan Explorer',
        activate: release => {
          controller.selectRelease({ selection: 'vulcan', shiftKey: release.shiftKey });
        },
      };
    if (view.route === 'start' && control.scriptOffset === 20239)
      return {
        label: 'Select',
        activate: () => {
          drafts.preview(view.selection);
          controller.preview();
        },
      };
    if (view.route === 'preview' && control.scriptOffset === 36965) {
      const startId = entryStartRequest(view.selection, definition.starts);
      const available = startId !== null;
      return {
        label: 'Engage',
        disabled: !available,
        activate: () => {
          if (available) onStart(startId, drafts.identity());
        },
      };
    }
    const start = entryContent.starts.find(start => start.sourceOffset === control.scriptOffset);
    const sourceLabels: Readonly<Record<number, string>> = {
      3738: 'Background',
      4129: 'Cursor',
      4625: 'Load plug-ins',
      5525: 'Graphic quality',
      11715: 'Select saved game',
      12218: 'Play saved game',
      12786: 'Delete saved game',
      13758: 'Select saved game 2',
      14144: 'Delete saved game 2',
      14764: 'Delete saved game 3',
      15384: 'Delete saved game 4',
      16004: 'Delete saved game 5',
      16624: 'Delete saved game 6',
      17244: 'Select saved game 3',
      17630: 'Select saved game 4',
      18016: 'Select saved game 5',
      18402: 'Select saved game 6',
    };
    return { label: start?.label ?? sourceLabels[control.scriptOffset] ?? 'Unavailable control', disabled: true };
  };
  const instructionControls = entryContent.instructionControls.map(source => ({
    scriptOffset: source.scriptOffset,
    name: '',
    depth: 0,
    artwork: null,
    paths: source.bounds.map(
      b => `M ${b.left} ${b.top} L ${b.right} ${b.top} L ${b.right} ${b.bottom} L ${b.left} ${b.bottom} Z`
    ),
  }));
  return (
    <main className="bm1-entry" aria-label="Broken Mirror entry">
      <div
        className="bm1-stage-frame"
        data-entry-route={view.route}
        data-entry-selection={view.selection}
        aria-busy={assetStatus === 'loading'}
      >
        {assetStatus === 'ready' && (
          <svg
            key={`${view.route}:${view.selection}`}
            className="bm1-stage"
            viewBox="0 0 600 450"
            width="600"
            height="450"
            aria-label={`${view.route} screen`}
          >
            <image href={entryAsset(file)} width="600" height="450" className="bm1-source-ink" />
            {plane &&
              [...plane.controls]
                .sort((a, b) => a.depth - b.depth)
                .map(control => {
                  const target = action(control);
                  return (
                    <SourceControl
                      key={control.scriptOffset}
                      control={control}
                      label={target.label}
                      {...(target.activate ? { onActivate: target.activate } : {})}
                      disabled={target.disabled ?? false}
                    />
                  );
                })}
            {view.route === 'preview' &&
              editableStartFields.map(field => {
                const key = (
                  {
                    resources: 'resources',
                    myname: 'captainName',
                    myshipname: 'shipName',
                    mygovtname: 'governmentName',
                  } as const
                )[field.variable as 'resources' | 'myname' | 'myshipname' | 'mygovtname'];
                const labels: Record<keyof EditableStartDraft, string> = {
                  resources: 'Resources',
                  captainName: 'Captain name',
                  shipName: 'Ship name',
                  governmentName: 'Government name',
                };
                return (
                  <EditableSourceInput
                    key={field.offset}
                    field={field}
                    value={draft[key]}
                    label={labels[key]}
                    onChange={value => {
                      drafts.edit(key, value);
                    }}
                  />
                );
              })}
            {view.route === 'instructions' &&
              instructionControls.map(control => (
                <SourceControl
                  key={control.scriptOffset}
                  control={control}
                  label={control.scriptOffset === 759 ? 'Main Menu' : 'Next instruction page'}
                  disabled={control.scriptOffset !== 759}
                  {...(control.scriptOffset === 759 ? { onActivate: controller.return } : {})}
                />
              ))}
          </svg>
        )}
        {assetStatus === 'loading' && (
          <p className="bm1-asset-notice" role="status">
            Loading…
          </p>
        )}
        {assetStatus === 'failed' && (
          <div className="bm1-asset-notice" role="alert">
            Menu artwork could not be loaded. <button onClick={artwork.retry}>Retry</button>
          </div>
        )}
      </div>
      {view.route === 'options' && (
        <p className="bm1-entry-note">
          Display settings and plug-ins are not yet available. Keys shows the original reference controls.
        </p>
      )}
      {view.route === 'keys' && (
        <p className="bm1-entry-note">Reference controls. Key rebinding is not available in this build.</p>
      )}
      {view.route === 'start' && (
        <p className="bm1-entry-note">
          Non-Aligned Humanoid, Earth Officer, Klingon Warrior, Ferengi Merchant, Romulan Soldier, Vulcan Explorer and
          Cardassian Minion are available. Hold Shift when releasing Cardassian Gul to select its separate start. Select
          reviews the current ship before Engage.
        </p>
      )}
      {view.route === 'preview' && (
        <p className="bm1-entry-note">
          Engage starts this ship with the entered names. Editing the resource display does not change your balances.
          Browser saves use the in-game controls.
        </p>
      )}
      {view.route === 'preview' && Object.values(draft).some(hasUnsupportedSourceGlyph) && (
        <p role="status" className="bm1-entry-note">
          Some entered characters are outside the original embedded font. Those fields use browser text for display;
          their entered values are preserved.
        </p>
      )}
      {view.route === 'instructions' && (
        <p className="bm1-entry-note">Original introduction. Further instruction pages are not yet available.</p>
      )}
      {view.route === 'saved' && (
        <section className="bm1-browser-saves" aria-label="Browser saves">
          <p>
            The original six-slot layout is shown for reference. Use the browser save controls below to load or import a
            game.
          </p>
          {saveTools}
        </section>
      )}
    </main>
  );
}
