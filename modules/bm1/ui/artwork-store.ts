/**
 * The single owner of BM1 artwork decoding and retention.
 *
 * Every consumer (entry, HUD, local contact preparation, deferred panels)
 * acquires leases on exact URL sets instead of decoding its own copies:
 *
 * - In-flight work is deduplicated per URL; a URL decodes at most once while
 *   anyone holds it.
 * - Decoded `HTMLImageElement`s are retained while at least one lease holds the
 *   URL, so the browser keeps their decoded bitmaps and later renders are instant.
 * - `readiness(urls)` is synchronous: a set whose URLs are all decoded is ready
 *   in the same render, so prepared screens never pass through a loading state.
 * - A failed URL stays failed (visible to its consumers) until `retry`, which
 *   starts a fresh image for it, or until it is acquired again after every
 *   holder released it. Obsolete completions are ignored because each
 *   attempt is compared against the URL's current record.
 * - When the last lease on a URL is released, eviction is deferred by one
 *   scheduler turn. React StrictMode replays and keyed remounts (for example a
 *   presentation remounting for a new system) release and re-acquire within the
 *   same commit, and must not discard and re-decode warmed images.
 *
 * Lifetimes are expressed by who holds leases: the module client holds entry
 * artwork for the page, gameplay presentations hold their system's sets, and
 * deferred panels hold what they display. URLs come only from validated module
 * content, never from saves or the network.
 */
export type ArtworkReadiness = 'loading' | 'ready' | 'failed';

export interface ArtworkLease {
  /** Settles when every URL in the set has decoded; rejects if any fails. */
  readonly ready: Promise<void>;
  /** Idempotent. After release the lease no longer keeps any URL alive. */
  release(): void;
}

export interface ArtworkStore {
  readiness(urls: readonly string[]): ArtworkReadiness;
  acquire(urls: readonly string[]): ArtworkLease;
  /** Start fresh attempts for failed URLs in this set; ready URLs are kept. */
  retry(urls: readonly string[]): void;
  subscribe(listener: () => void): () => void;
  /** Release every image and ignore later completions (page exit). */
  dispose(): void;
}

interface DecodableImage {
  src: string;
  decode(): Promise<void>;
}

interface ArtworkRecord {
  readonly image: DecodableImage;
  state: ArtworkReadiness;
  references: number;
  evictionPending: boolean;
  readonly settled: Promise<void>;
}

export interface ArtworkStoreOptions {
  /** Test seam; production decodes browser images. */
  readonly createImage?: () => DecodableImage;
  /** Test seam for the deferred eviction turn; production uses `setTimeout(0)`. */
  readonly schedule?: (task: () => void) => void;
}

export function createArtworkStore({
  createImage = () => new Image(),
  schedule = task => {
    setTimeout(task, 0);
  },
}: ArtworkStoreOptions = {}): ArtworkStore {
  const records = new Map<string, ArtworkRecord>();
  const listeners = new Set<() => void>();
  let disposed = false;
  const notify = () => listeners.forEach(listener => listener());

  const start = (url: string, references: number): ArtworkRecord => {
    const image = createImage();
    let record!: ArtworkRecord;
    const settled = Promise.resolve().then(() => {
      image.src = url;
      return image.decode();
    });
    record = { image, state: 'loading', references, evictionPending: false, settled };
    records.set(url, record);
    settled.then(
      () => {
        if (disposed || records.get(url) !== record) return;
        record.state = 'ready';
        notify();
      },
      () => {
        if (disposed || records.get(url) !== record) return;
        record.state = 'failed';
        notify();
      }
    );
    return record;
  };

  const evict = (url: string, record: ArtworkRecord) => {
    record.evictionPending = false;
    if (record.references > 0 || records.get(url) !== record) return;
    records.delete(url);
    record.image.src = '';
  };

  const unique = (urls: readonly string[]) => [...new Set(urls)];

  const store: ArtworkStore = {
    readiness: urls => {
      // An unheld failure is pending a fresh attempt on its next acquire, so a
      // remounting consumer must not read the previous holder's outcome.
      const states = unique(urls).map(url => {
        const record = records.get(url);
        if (!record || (record.state === 'failed' && record.references === 0)) return 'loading';
        return record.state;
      });
      if (states.some(state => state === 'failed')) return 'failed';
      if (states.every(state => state === 'ready')) return 'ready';
      return 'loading';
    },
    acquire: urls => {
      if (disposed) return Object.freeze({ ready: Promise.reject(new Error('Artwork store disposed.')), release() {} });
      const held = unique(urls);
      const settled = held.map(url => {
        const existing = records.get(url);
        // A failure nobody still holds is not inherited: a remounted consumer
        // (for example a retried scene) gets a fresh attempt. Concurrent holders
        // share one outcome and recover through retry().
        if (existing && !(existing.state === 'failed' && existing.references === 0)) {
          existing.references += 1;
          return existing.settled;
        }
        if (existing) existing.image.src = '';
        return start(url, 1).settled;
      });
      let released = false;
      const ready = Promise.all(settled).then(() => undefined);
      // Consumers observe readiness synchronously; an unobserved rejection here
      // is an expected failure path, not an unhandled error.
      ready.catch(() => undefined);
      return Object.freeze({
        ready,
        release: () => {
          if (released || disposed) return;
          released = true;
          held.forEach(url => {
            const record = records.get(url);
            if (!record) return;
            record.references = Math.max(0, record.references - 1);
            if (record.references > 0 || record.evictionPending) return;
            record.evictionPending = true;
            schedule(() => evict(url, record));
          });
        },
      });
    },
    retry: urls => {
      if (disposed) return;
      const failed = unique(urls).filter(url => records.get(url)?.state === 'failed');
      if (failed.length === 0) return;
      failed.forEach(url => {
        const previous = records.get(url)!;
        previous.image.src = '';
        start(url, previous.references);
      });
      notify();
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      records.forEach(record => {
        record.image.src = '';
      });
      records.clear();
      listeners.clear();
    },
  };
  return Object.freeze(store);
}
