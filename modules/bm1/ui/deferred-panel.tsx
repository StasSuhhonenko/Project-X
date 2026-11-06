/** Loads code and only the requested panel's artwork. Controllers remain
 * mounted after preparation so selection/replacement/focus cleanup still runs. */
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { useArtwork } from './use-artwork';

export interface PanelModule<P> {
  readonly Component: ComponentType<P>;
  readonly assets: (props: P) => readonly string[];
}
export type PanelBusyChange = (id: string, busy: boolean) => void;

export function DeferredPanel<P extends object>({
  id,
  label,
  active,
  load,
  panelProps,
  onBusyChange,
  fallbackActions,
}: {
  readonly id: string;
  readonly label: string;
  readonly active: boolean;
  readonly load: () => Promise<PanelModule<P>>;
  readonly panelProps: P;
  readonly onBusyChange?: PanelBusyChange | undefined;
  readonly fallbackActions?: ReactNode;
}) {
  const [module, setModule] = useState<PanelModule<P> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // An inactive retained controller must not start loading art for unrelated
  // selections. The next request recomputes its exact required asset set.
  const assets = useRef<readonly string[]>([]);
  if (active && module) assets.current = [...new Set([...assets.current, ...module.assets(panelProps)])];
  const artwork = useArtwork(assets.current, module !== null);
  const ready = module !== null && artwork.ready === 'ready';
  const busy = active && !ready;
  useEffect(() => {
    if (!active || module) return;
    let current = true;
    setError(null);
    void load().then(
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
  }, [active, module, load, attempt]);
  useEffect(() => {
    onBusyChange?.(id, busy);
    return () => onBusyChange?.(id, false);
  }, [id, busy, onBusyChange]);
  if (ready && module) {
    const Component = module.Component;
    return <Component {...panelProps} />;
  }
  if (!active) return null;
  const failed = error !== null || artwork.ready === 'failed';
  return (
    <div className="bm1-panel-loading" data-game-input="blocked" role={failed ? 'alert' : 'status'}>
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
