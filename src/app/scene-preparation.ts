/** One host owner for preflight and attachment. A destination can prepare
 * alongside the current visit, with an independent generation, abort signal
 * and cosmetic seed. Retired preparations stay alive for pending attachments. */
import type {
  PreparedSpatialScene,
  SpatialPresentation,
  SpatialSnapshot,
} from '../rendering/contracts/spatial-presentation';
import { selectPlayerEntity, type WorldState } from '../simulation/model/world-state';

interface Entry {
  readonly generation: number;
  readonly key: string;
  readonly sessionRevision: number;
  readonly cosmeticSeed: number;
  readonly abort: AbortController;
  readonly pending: Promise<PreparedSpatialScene>;
  owner?: PreparedSpatialScene;
  references: number;
  obsolete: boolean;
  released: boolean;
}

type Slot = 'visit' | 'destination';

/** This service owns no world mutation and can restart after StrictMode cleanup. */
export function createScenePreparation(
  spatial: SpatialPresentation,
  snapshot: () => SpatialSnapshot,
  cosmeticSeed = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0]!
) {
  let generation = 0;
  const entries: Record<Slot, Entry | null> = { visit: null, destination: null };
  // Retain the seed across remounts/refits. Preflight has its own entry and
  // lease so a failed departure leaves the origin view and its input usable.
  let visit: { readonly sessionRevision: number; readonly systemId: number; readonly seed: number } | null = null;
  const releaseUnused = (entry: Entry) => {
    if (!entry.owner || entry.references > 0 || entry.released) return;
    entry.released = true;
    entry.owner.dispose();
  };
  const retire = (entry: Entry) => {
    entry.obsolete = true;
    entry.abort.abort();
    releaseUnused(entry);
  };
  const clear = (slot: Slot) => {
    const entry = entries[slot];
    entries[slot] = null;
    if (entry) retire(entry);
  };
  const cancel = () => {
    generation += 1;
    clear('destination');
    clear('visit');
  };
  const identify = (world: WorldState) => {
    const { world: live, sessionRevision } = snapshot();
    const player = selectPlayerEntity(world);
    const systemId = player.location.systemId;
    if (visit?.sessionRevision !== sessionRevision) {
      if (visit) cancel();
      visit = { sessionRevision, systemId: selectPlayerEntity(live ?? world).location.systemId, seed: cosmeticSeed() };
    }
    const slot: Slot = systemId === visit.systemId ? 'visit' : 'destination';
    const key = `${sessionRevision}:${systemId}:${player.definitionId}`;
    return { slot, key, systemId, world, visit };
  };
  const begin = ({ slot, key, world, visit }: ReturnType<typeof identify>) => {
    generation += 1;
    clear(slot);
    const abort = new AbortController();
    const request = {
      world,
      sessionRevision: visit.sessionRevision,
      generation,
      cosmeticSeed: slot === 'visit' ? visit.seed : cosmeticSeed(),
      signal: abort.signal,
    };
    // Promise.resolve also captures a synchronous adapter failure.
    const entry: Entry = {
      generation,
      key,
      sessionRevision: request.sessionRevision,
      cosmeticSeed: request.cosmeticSeed,
      abort,
      references: 0,
      obsolete: false,
      released: false,
      pending: Promise.resolve().then(() => spatial.prepareScene(request)),
    };
    entries[slot] = entry;
    void entry.pending.then(
      owner => {
        entry.owner = owner;
        if (entry.obsolete) releaseUnused(entry);
      },
      () => {
        if (entries[slot] === entry) clear(slot);
      }
    );
    return entry;
  };
  return Object.freeze({
    getGeneration: () => generation,
    cancel,
    /** Drop speculative assets without invalidating the visit's attachment. */
    cancelTravel: () => {
      if (!entries.destination) return;
      generation += 1;
      clear('destination');
    },
    /** Promote the seed and lease only when the exact paid arrival is ready. */
    confirmVisit: (world: WorldState) => {
      if (snapshot().world !== world) return;
      const { key, systemId } = identify(world);
      const destination = entries.destination;
      if (destination?.key !== key) return;
      clear('visit');
      entries.visit = destination;
      entries.destination = null;
      visit = {
        sessionRevision: destination.sessionRevision,
        systemId,
        seed: destination.cosmeticSeed,
      };
    },
    projectPlayer: (world: WorldState) => spatial.projectPlayer?.(world) ?? null,
    /** Explicit preflight always creates a new operation, including same-hull refit. */
    prepare: async (world: WorldState): Promise<void> => {
      const identity = identify(world);
      const entry = begin(identity);
      await entry.pending;
      if (entry.obsolete || snapshot().sessionRevision !== entry.sessionRevision)
        throw new Error('Scene preparation was superseded.');
    },
    acquire: async (world: WorldState) => {
      const identity = identify(world);
      const prepared = entries[identity.slot];
      const entry = prepared?.key === identity.key ? prepared : begin(identity);
      entry.references += 1;
      let returned = false;
      const release = () => {
        if (returned) return;
        returned = true;
        entry.references -= 1;
        if (entry.references > 0) return;
        if (entries.visit === entry) entries.visit = null;
        if (entries.destination === entry) entries.destination = null;
        retire(entry);
      };
      try {
        const owner = await entry.pending;
        return Object.freeze({
          owner,
          generation: entry.generation,
          release,
          isCurrent: () => !entry.obsolete && !returned && snapshot().sessionRevision === entry.sessionRevision,
        });
      } catch (error) {
        release();
        throw error;
      }
    },
  });
}
export type ScenePreparation = ReturnType<typeof createScenePreparation>;
