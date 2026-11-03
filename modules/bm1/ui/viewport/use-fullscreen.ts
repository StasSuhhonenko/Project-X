/** Browser fullscreen ownership for the composed game frame. No gameplay state. */
import { useEffect, useState, type RefObject } from 'react';

/** Observe native changes, including Escape and fullscreen entered elsewhere.
 * The caller owns the frame ref; this hook owns only its document listener and
 * request feedback. Request failures never alter simulation or panel readiness. */
export function useFullscreen(frame: RefObject<HTMLElement | null>) {
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);

  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === frame.current);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, [frame]);

  const toggleFullscreen = () => {
    setFullscreenError(null);
    const request = document.fullscreenElement
      ? document.exitFullscreen()
      : frame.current?.requestFullscreen?.();
    if (!request) {
      setFullscreenError('Full screen is unavailable in this browser.');
      return;
    }
    void request.catch(() => setFullscreenError('Full screen could not be opened.'));
  };

  return { fullscreen, fullscreenError, toggleFullscreen };
}
