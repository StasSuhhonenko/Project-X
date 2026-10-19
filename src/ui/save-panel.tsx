/** Host-owned save operations with presentation placed by the active entry. */
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ZodError } from 'zod';
import type { AppStore } from '../app/app-store';
import type { GameModule } from '../content/game-module';
import { createIndexedDbSaveSlot, loadCurrentGame, saveCurrentGame } from '../platform/browser/indexeddb-save-slot';
import { downloadGameJson, exportCurrentGameJson, importGameFile } from '../platform/browser/save-file-transfer';

type Feedback = { readonly kind: 'success' | 'error'; readonly message: string } | null;

function errorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const location = issue?.path.join('.') || 'save data';
    return `Invalid save at ${location}: ${issue?.message ?? 'validation failed'}.`;
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Call once in the persistent application composition, then place the returned
 * controls in the active presentation. Busy/feedback and the operation lock
 * survive entry routes and scene remounts, including successful load/import.
 * Hiding the controls does not cancel an already requested validated operation.
 */
export function useSavePanel({ store, gameModule, canSave }: {
  readonly store: AppStore;
  readonly gameModule: GameModule;
  readonly canSave: boolean;
}) {
  const slot = useMemo(() => createIndexedDbSaveSlot(gameModule), [gameModule]);
  const fileInput = useRef<HTMLInputElement>(null);
  const operation = useRef(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const run = async (action: () => Promise<string> | string): Promise<void> => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      setFeedback({ kind: 'success', message: await action() });
    } catch (error) {
      setFeedback({ kind: 'error', message: errorMessage(error) });
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };

  const onImport = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    // Reset before awaiting so selecting the same repaired file fires again.
    event.currentTarget.value = '';
    if (!file) return;
    void run(async () => {
      await importGameFile(store, file);
      return `Imported ${file.name}.`;
    });
  };

  return (
    <section className="save-panel" aria-label="Save and load">
      <h2>Save and load</h2>
      <p>One browser slot for this game. Export a JSON file to keep a separate copy.</p>
      <div className="save-actions">
        {canSave && <button type="button" disabled={busy} onClick={() => void run(async () => {
          await saveCurrentGame(store, slot);
          return 'Saved to this browser.';
        })}>Save in browser</button>}
        <button type="button" disabled={busy} onClick={() => void run(async () => {
          const loaded = await loadCurrentGame(store, slot);
          return loaded ? 'Loaded browser save.' : 'No browser save found for this game.';
        })}>Load browser save</button>
        {canSave && <button type="button" disabled={busy} onClick={() => void run(() => {
          downloadGameJson(exportCurrentGameJson(store), gameModule);
          return 'Save file download started.';
        })}>Export file</button>}
        <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>Import file</button>
        <input ref={fileInput} className="save-file-input" type="file" accept=".json,application/json"
          aria-label="Choose save file" onChange={onImport} />
      </div>
      {feedback && <p className={`save-feedback ${feedback.kind}`}
        role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.message}</p>}
    </section>
  );
}
