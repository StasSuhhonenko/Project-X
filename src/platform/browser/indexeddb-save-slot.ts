/** One browser save slot per selected module, backed by atomic IndexedDB writes. */
import type { AppStore } from '../../app/app-store';
import type { GameModule } from '../../content/game-module';

const DATABASE_VERSION = 1;
const STORE_NAME = 'slots';
const SLOT_KEY = 'active';

/** JSON-only storage contract. S18 remains the authority for save validation. */
export interface SaveSlotStorage {
  read(): Promise<string | null>;
  write(json: string): Promise<void>;
}

function storageError(context: string, cause: unknown): Error {
  const detail = cause instanceof Error ? cause.message : String(cause ?? 'unknown error');
  return new Error(`${context}: ${detail}`);
}

/**
 * Open a module-scoped database on demand. Connections close after each
 * operation so a future schema upgrade cannot be held open by an idle scene.
 */
export function createIndexedDbSaveSlot(gameModule: GameModule, factory?: IDBFactory | null): SaveSlotStorage {
  const databaseName = `project-x-save-${gameModule.definition.id}`;
  const browserFactory = (): IDBFactory => {
    try {
      const selected = factory === undefined ? globalThis.indexedDB : factory;
      if (selected) return selected;
    } catch (error) {
      throw storageError('Browser save storage is unavailable', error);
    }
    throw new Error('Browser save storage is unavailable.');
  };
  const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = browserFactory().open(databaseName, DATABASE_VERSION);
    } catch (error) {
      reject(storageError('Could not open browser save storage', error));
      return;
    }
    let blocked = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Browser save storage upgrade is blocked by another open tab.'));
    };
    request.onerror = () => reject(storageError('Could not open browser save storage', request.error));
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });

  return {
    read: async () => {
      const database = await open();
      try {
        return await new Promise<string | null>((resolve, reject) => {
          let transaction: IDBTransaction;
          try {
            transaction = database.transaction(STORE_NAME, 'readonly');
            const request = transaction.objectStore(STORE_NAME).get(SLOT_KEY);
            let value: unknown;
            request.onsuccess = () => { value = request.result; };
            request.onerror = () => reject(storageError('Could not read the save slot', request.error));
            transaction.oncomplete = () => {
              if (value === undefined) { resolve(null); return; }
              if (typeof value !== 'string') {
                reject(new Error('The saved slot contains invalid data.'));
                return;
              }
              resolve(value);
            };
            transaction.onabort = () => reject(storageError('Save read was aborted', transaction.error));
            transaction.onerror = () => reject(storageError('Could not read the save slot', transaction.error));
          } catch (error) {
            reject(storageError('Could not read the save slot', error));
          }
        });
      } finally {
        database.close();
      }
    },
    write: async json => {
      const database = await open();
      try {
        await new Promise<void>((resolve, reject) => {
          let transaction: IDBTransaction | undefined;
          try {
            transaction = database.transaction(STORE_NAME, 'readwrite');
            const writeTransaction = transaction;
            // IndexedDB keeps the previous record if this transaction aborts.
            // A request success alone is insufficient; only oncomplete means
            // the replacement is durable within the browser's storage contract.
            writeTransaction.oncomplete = () => resolve();
            writeTransaction.onabort = () => reject(storageError('Save write was aborted', writeTransaction.error));
            writeTransaction.onerror = () => reject(storageError('Could not write the save slot', writeTransaction.error));
            writeTransaction.objectStore(STORE_NAME).put(json, SLOT_KEY);
          } catch (error) {
            if (transaction) {
              try { transaction.abort(); } catch { /* Transaction may already be inactive. */ }
            }
            reject(storageError('Could not write the save slot', error));
          }
        });
      } finally {
        database.close();
      }
    },
  };
}

/** Capture before opening storage; a failed write leaves the live game intact. */
export async function saveCurrentGame(store: AppStore, slot: SaveSlotStorage): Promise<void> {
  const snapshot = store.getState().captureSaveSnapshot();
  await slot.write(JSON.stringify(snapshot));
}

/**
 * Read data first, then let S18 validate and publish one restored session.
 * Empty storage returns false; malformed/incompatible data throws and leaves
 * the current game untouched for S20 to report to the player.
 */
export async function loadCurrentGame(store: AppStore, slot: SaveSlotStorage): Promise<boolean> {
  const json = await slot.read();
  if (json === null) return false;
  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch (error) {
    throw storageError('The saved slot is not valid JSON', error);
  }
  store.getState().restoreSaveSnapshot(input);
  return true;
}
