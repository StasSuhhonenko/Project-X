/** One host owner for preflight and attachment. Each request has a generation,
 * abort signal and cosmetic seed; prepared leases survive pending attachments.
 * Cancellation invalidates authority immediately, even for unabortable loaders. */
import type {
  PreparedSpatialScene,
  SpatialPresentation,
  SpatialSnapshot,
} from '../rendering/contracts/spatial-presentation';
import { selectPlayerEntity, type WorldState } from '../simulation/model/world-state';

interface Entry {
  readonly generation: number;
  readonly key: string;
  readonly abort: AbortController;
  readonly pending: Promise<PreparedSpatialScene>;
  owner?: PreparedSpatialScene;
  references: number;
  obsolete: boolean;
  released: boolean;
}

/** This service owns no world mutation and can restart after StrictMode cleanup. */
export function createScenePreparation(
  spatial: SpatialPresentation,
  snapshot: () => SpatialSnapshot,
  cosmeticSeed = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0]!
) {
  let generation = 0;
  let current: Entry | null = null;
  const key = (world: WorldState) => {
    const player = selectPlayerEntity(world);
    return `${snapshot().sessionRevision}:${player.location.systemId}:${player.definitionId}`;
  };
  const releaseUnused = (entry: Entry) => {
    if (!entry.owner || entry.references > 0 || entry.released) return;
    entry.released = true;
    entry.owner.dispose();
  };
  const cancel = () => {
    generation += 1;
    if (!current) return;
    const old = current;
    current = null;
    old.obsolete = true;
    old.abort.abort();
    releaseUnused(old);
  };
  const begin = (world: WorldState) => {
    cancel();
    const abort = new AbortController();
    const request = {
      world,
      sessionRevision: snapshot().sessionRevision,
      generation,
      cosmeticSeed: cosmeticSeed(),
      signal: abort.signal,
    };
    // Promise.resolve also captures a synchronous adapter failure.
    const entry: Entry = {
      generation,
      key: key(world),
      abort,
      references: 0,
      obsolete: false,
      released: false,
      pending: Promise.resolve().then(() => spatial.prepareScene(request)),
    };
    current = entry;
    void entry.pending.then(
      owner => {
        entry.owner = owner;
        if (entry.obsolete) releaseUnused(entry);
      },
      () => {
        if (current === entry) current = null;
      }
    );
    return entry;
  };
  return Object.freeze({
    getGeneration: () => generation,
    cancel,
    projectPlayer: (world: WorldState) => spatial.projectPlayer?.(world) ?? null,
    /** Explicit preflight always creates a new operation, including same-hull refit. */
    prepare: async (world: WorldState): Promise<void> => {
      const entry = begin(world);
      await entry.pending;
      if (current !== entry || entry.obsolete) throw new Error('Scene preparation was superseded.');
    },
    acquire: async (world: WorldState) => {
      const entry = current?.key === key(world) && !current.released ? current : begin(world);
      entry.references += 1;
      let returned = false;
      const release = () => {
        if (returned) return;
        returned = true;
        entry.references -= 1;
        if (entry.references === 0) {
          if (current === entry) current = null;
          entry.obsolete = true;
          entry.abort.abort();
          releaseUnused(entry);
        }
      };
      try {
        const owner = await entry.pending;
        return Object.freeze({
          owner,
          generation: entry.generation,
          release,
          isCurrent: () =>
            current === entry &&
            !entry.obsolete &&
            !returned &&
            snapshot().sessionRevision === Number(entry.key.split(':')[0]),
        });
      } catch (error) {
        release();
        throw error;
      }
    },
  });
}
export type ScenePreparation = ReturnType<typeof createScenePreparation>;
