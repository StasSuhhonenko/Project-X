/** React access to the BM1 artwork store. URLs come only from validated module
 * assets; the store owns decoding, retention and stale-completion handling. */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createArtworkStore, type ArtworkReadiness, type ArtworkStore } from './artwork-store';

export type { ArtworkReadiness } from './artwork-store';

/** Page-lifetime store for the selected BM1 client. The module client disposes
 * it on page exit; scene and panel consumers only hold and release leases. */
export const artworkStore = createArtworkStore();

/** Stable identity for a URL set, so effects re-run only when the set changes. */
const setKey = (assets: readonly string[]) => JSON.stringify([...new Set(assets)]);

/**
 * Hold a lease on `assets` while mounted and report their readiness. A set that
 * is already decoded (by this or any other consumer) is ready in the same
 * render. A set containing any undecoded URL is unavailable immediately, before
 * its effect runs, so a previous readiness can never expose newly selected art.
 *
 * A failure is reported only once this consumer holds its own lease. During a
 * remount (for example a retried scene) the previous holder's failure is still
 * visible at render time, but this consumer's acquire starts a fresh attempt.
 */
export function useArtwork(assets: readonly string[], enabled = true, store: ArtworkStore = artworkStore) {
  const key = setKey(assets);
  const [heldKey, setHeldKey] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const lease = store.acquire(JSON.parse(key) as string[]);
    setHeldKey(key);
    return lease.release;
  }, [store, key, enabled]);
  const stored = useSyncExternalStore(store.subscribe, () =>
    enabled ? store.readiness(JSON.parse(key) as string[]) : ('loading' as ArtworkReadiness)
  );
  const readiness: ArtworkReadiness = stored === 'failed' && heldKey !== key ? 'loading' : stored;
  return {
    ready: readiness,
    retry: () => store.retry(JSON.parse(key) as string[]),
  };
}
