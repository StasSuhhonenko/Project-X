/** Loads code and only the requested panel's artwork. Controllers remain
 * mounted after preparation so selection/replacement/focus cleanup still runs. */
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import type { PanelLoader } from './panel-loaders';
import { useArtwork, type ArtworkReadiness } from './use-artwork';

export interface PanelModule<P> {
  readonly Component: ComponentType<P>;
  readonly assets: (props: P) => readonly string[];
}
export type PanelBusyChange = (id: string, busy: boolean) => void;

/**
 * Fallback only. On the normal path a system's panels, code and artwork are
 * prepared before the scene is revealed (see use-gameplay-artwork.ts), so a
 * deferred panel renders in the same commit as its activation. This delay
 * keeps an unexpected short preparation (an unforeseen resource) visually
 * silent instead of flashing the full-stage loading surface.
 */
export const PANEL_LOADING_INDICATOR_DELAY_MS = 200;

/** What the deferred slot renders:
 * - `panel`: the prepared component (also kept mounted while a later selection's
 *   extra artwork decodes, so its controller and the open view never unmount);
 * - `pending`: an invisible preparation surface that still holds fallback controls;
 * - `loading` / `failed`: the visible loading or retry surface;
 * - `hidden`: nothing. */
export type PanelDisplay = 'panel' | 'pending' | 'loading' | 'failed' | 'hidden';

export function selectPanelDisplay({
  active,
  loaded,
  artwork,
  loadFailed,
  shownBefore,
  indicatorDue,
}: {
  readonly active: boolean;
  readonly loaded: boolean;
  readonly artwork: ArtworkReadiness;
  readonly loadFailed: boolean;
  /** The component has rendered at least once with all its artwork prepared. */
  readonly shownBefore: boolean;
  readonly indicatorDue: boolean;
}): PanelDisplay {
  if (loaded && artwork === 'ready') return 'panel';
  if (loadFailed || artwork === 'failed') return active ? 'failed' : 'hidden';
  // Keep an already prepared panel mounted while newly selected artwork decodes.
  // The incremental decode is a single portrait or icon; unmounting here is what
  // used to flash the loading surface on every new contact.
  if (loaded && shownBefore) return 'panel';
  if (!active) return 'hidden';
  return indicatorDue ? 'loading' : 'pending';
}

export function DeferredPanel<P extends object>({
  id,
  label,
  active,
  loader,
  panelProps,
  onBusyChange,
  fallbackActions,
}: {
  readonly id: string;
  readonly label: string;
  readonly active: boolean;
  /** Page-lifetime handle; a module already loaded mounts in the same render. */
  readonly loader: PanelLoader<PanelModule<P>>;
  readonly panelProps: P;
  readonly onBusyChange?: PanelBusyChange | undefined;
  readonly fallbackActions?: ReactNode;
}) {
  const [loadedModule, setModule] = useState<PanelModule<P> | null>(null);
  // Read the page-lifetime handle every render: code prepared after this panel
  // mounted (by system preparation) is usable on its very first activation.
  const module = loadedModule ?? loader.current();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [indicatorDue, setIndicatorDue] = useState(false);
  // An inactive retained controller must not start loading art for unrelated
  // selections. The next request recomputes its exact required asset set.
  const assets = useRef<readonly string[]>([]);
  if (active && module) assets.current = [...new Set([...assets.current, ...module.assets(panelProps)])];
  const artwork = useArtwork(assets.current, module !== null);
  const ready = module !== null && artwork.ready === 'ready';
  const shownBefore = useRef(false);
  if (ready) shownBefore.current = true;
  // Input stays held while any required artwork is outstanding, including the
  // short incremental decode during which the prepared panel stays mounted.
  const busy = active && !ready;
  const display = selectPanelDisplay({
    active,
    loaded: module !== null,
    artwork: artwork.ready,
    loadFailed: error !== null,
    shownBefore: shownBefore.current,
    indicatorDue,
  });
  const waiting = display === 'pending' || display === 'loading';
  useEffect(() => {
    if (!active || module) return;
    let current = true;
    setError(null);
    void loader.load().then(
      loaded => {
        if (current) setModule(loaded);
      },
      failure => {
        if (current) setError(failure instanceof Error ? failure.message : String(failure));
      }
    );
    return () => {
      current = false;
    };
  }, [active, module, loader, attempt]);
  useEffect(() => {
    onBusyChange?.(id, busy);
    return () => onBusyChange?.(id, false);
  }, [id, busy, onBusyChange]);
  useEffect(() => {
    if (!waiting) {
      setIndicatorDue(false);
      return;
    }
    const timer = setTimeout(() => setIndicatorDue(true), PANEL_LOADING_INDICATOR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [waiting]);
  if (display === 'hidden') return null;
  if (display === 'panel' && module) {
    const Component = module.Component;
    return <Component {...panelProps} />;
  }
  const failed = display === 'failed';
  const pending = display === 'pending';
  return (
    <div
      className={pending ? 'bm1-panel-loading bm1-panel-loading--pending' : 'bm1-panel-loading'}
      data-game-input="blocked"
      role={failed ? 'alert' : 'status'}
    >
      <p>{failed ? `${label} could not be loaded.` : `Loading ${label.toLowerCase()}…`}</p>
      {failed && (
        <button
          onClick={() => {
            setError(null);
            setAttempt(value => value + 1);
            artwork.retry();
          }}
        >
          Retry {label.toLowerCase()}
        </button>
      )}
      {fallbackActions}
    </div>
  );
}
