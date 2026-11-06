/** One cancellable decode attempt. URLs come only from validated module assets.
 * Owners retain successful images while mounted; stale promises never publish. */
import { useEffect, useState } from 'react';

export function decodeArtwork(assets: readonly string[], onReady: () => void, onFailure: () => void) {
  let current = true;
  const images = [...new Set(assets)].map(asset => {
    const image = new Image();
    image.src = asset;
    return image;
  });
  void Promise.all(images.map(image => image.decode())).then(
    () => {
      if (current) onReady();
    },
    () => {
      if (current) onFailure();
    }
  );
  return () => {
    current = false;
    images.forEach(image => {
      image.src = '';
    });
  };
}

/** A changed URL set is unavailable immediately, before its effect runs. This
 * prevents old readiness exposing a newly selected panel or equipment icon. */
export function useArtwork(assets: readonly string[], enabled = true) {
  const key = JSON.stringify([...new Set(assets)]);
  const [attempt, setAttempt] = useState(0);
  const token = `${attempt}:${key}`;
  const [result, setResult] = useState({ token: '', ready: 'loading' as 'loading' | 'ready' | 'failed' });
  useEffect(() => {
    if (!enabled) return;
    return decodeArtwork(
      JSON.parse(key) as string[],
      () => setResult({ token, ready: 'ready' }),
      () => setResult({ token, ready: 'failed' })
    );
  }, [enabled, key, token]);
  return {
    ready: enabled && result.token === token ? result.ready : ('loading' as const),
    retry: () => setAttempt(value => value + 1),
  };
}
