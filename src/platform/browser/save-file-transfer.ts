/** Browser file boundary for the S18 JSON format; validation stays in the store. */
import type { AppStore } from '../../app/app-store';
import type { GameModule } from '../../content/game-module';
import { SAVE_SCHEMA_VERSION } from '../../persistence/save-snapshot';

/** Reject unusually large input before allocating/parsing its text. */
const MAX_IMPORT_BYTES = 16 * 1024 * 1024;

export function exportCurrentGameJson(store: AppStore): string {
  return JSON.stringify(store.getState().captureSaveSnapshot(), null, 2);
}

/** Invalid JSON or incompatible content leaves the current store untouched. */
export function importGameJson(store: AppStore, json: string): void {
  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }
  store.getState().restoreSaveSnapshot(input);
}

export async function importGameFile(store: AppStore, file: File): Promise<void> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error('The selected file is too large (maximum 16 MiB).');
  }
  importGameJson(store, await file.text());
}

/** Start a user-requested download; the browser owns the final file location. */
export function downloadGameJson(json: string, gameModule: GameModule): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${gameModule.definition.id}-save-v${SAVE_SCHEMA_VERSION}.json`;
  try {
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // Download dispatch can outlive click(); release the object URL afterward.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
