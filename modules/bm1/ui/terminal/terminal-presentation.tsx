/** UI-24 owns passive source paint, its disposable display clock and local
 * source navigation only. No world/store handle, damage, tick or restore API
 * crosses this boundary. The host has already disposed gameplay services. */
import { useEffect, useRef, useState } from 'react';
import type { TerminalPresentationProps } from '../../../../src/ui/terminal-presentation';
import { SourceControl } from '../source-control';
import { terminalAsset, terminalAssets, terminalContent, terminalPose, terminalSourceAction } from './terminal-content';
import './terminal.css';
import { playerActorScale } from '../player-actor-scale';

export function TerminalPresentation({ terminal, backdrop, onReturnToMenu, onRestart, saveTools }: TerminalPresentationProps) {
  const [ready, setReady] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [retry, setRetry] = useState(0);
  const [epoch, setEpoch] = useState<number | null>(null);
  const [now, setNow] = useState(() => performance.now());
  const [sourceFrame, setSourceFrame] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const stage = useRef<SVGSVGElement>(null);
  const activated = useRef(false);
  const state = terminalPose(epoch === null ? 0 : now - epoch);
  const frame = sourceFrame ?? state.frame;
  const page = sourceFrame !== null || state.kind === 'page';
  const controlAvailable = ready === 'ready' && page && frame === 26;
  useEffect(() => {
    let current = true;
    setReady('loading');
    const images = terminalAssets.map(file => { const image = new Image(); image.src = terminalAsset(file); return image; });
    void Promise.all(images.map(image => image.decode())).then(() => {
      if (!current) return;
      const started = performance.now();
      setEpoch(started); setNow(started); setReady('ready');
    }, () => { if (current) setReady('failed'); });
    return () => { current = false; images.forEach(image => { image.src = ''; }); };
  }, [retry, terminal.startedAtMs]);
  useEffect(() => {
    if (ready !== 'ready' || epoch === null || sourceFrame !== null || (state.kind === 'page' && state.frame === 26)) return;
    const timer = window.setInterval(() => setNow(performance.now()), 1000 / 13);
    return () => window.clearInterval(timer);
  }, [ready, epoch, sourceFrame, state.kind, state.frame]);
  useEffect(() => {
    if (sourceFrame === null) return;
    const action = terminalSourceAction(sourceFrame);
    if (action === 'entry') { onReturnToMenu(); return; }
    if (action !== 'return26') return;
    const timer = window.setTimeout(() => { activated.current = false; setSourceFrame(26); }, 1000 / 13);
    return () => window.clearTimeout(timer);
  }, [sourceFrame, onReturnToMenu]);
  useEffect(() => {
    if (controlAvailable) stage.current?.querySelector<SVGGElement>('[role="button"]')?.focus();
  }, [controlAvailable]);
  const ship = terminalContent.death.find(s => s.definitionId === terminal.playerDefinitionId);
  if (!ship) throw new Error('Death ship selector artwork is unavailable.');
  const asset = page ? terminalContent.page.find(p => p.frame === (sourceFrame ?? state.pose))!.file : ship.poses.find(p => p.frame === state.pose)!.file;
  const b = terminalContent.control.bounds;
  const spatial = terminal.playerSpatial;
  return <main className="bm1-terminal-presentation">
    <div className="bm1-terminal-stage-shell">
      {/* The host owns this frozen image, captured before disposing its live
        * renderer. Restored terminal snapshots may have no prior scene. */}
      {ready === 'ready' && !page && backdrop && <div className="bm1-terminal-backdrop">{backdrop}</div>}
      <svg ref={stage} className="bm1-terminal-stage" width="600" height="450" viewBox="0 0 600 450" role="group"
        aria-label="Player destroyed" data-terminal-state={ready === 'ready' ? page ? 'terminal' : 'death' : ready}
        data-terminal-frame={frame} data-terminal-pose={sourceFrame ?? state.pose}>
        <rect width="600" height="450" fill={ready === 'ready' && !page && backdrop ? 'transparent' : 'black'} />
        {ready === 'ready' && <>
          {page && <image href={terminalAsset(asset)} width="600" height="450" />}
          {!page && <g transform={`translate(${spatial.x} ${spatial.y}) rotate(${spatial.headingDegrees}) scale(${playerActorScale(ship?.playerScale, spatial.zoom)})`}>
            <image href={terminalAsset(asset)} x="-300" y="-225" width="600" height="450" />
          </g>}
          {controlAvailable && <g onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
            {/* Source Up black rectangle alpha50, hover alpha0. Focus indication
              * is semantic browser paint; it does not move the source region. */}
            <image href={terminalAsset(terminalContent.control.file)} width="600" height="450" opacity={hovered ? 0 : 1} pointerEvents="none" />
            <SourceControl control={{ scriptOffset: 1694, name: 'reincarnate', depth: 3, artwork: null,
              paths: [`M${b.left},${b.top} H${b.right} V${b.bottom} H${b.left} Z`] }} label="Reincarnate"
              onActivate={() => { if (activated.current) return; activated.current = true; setHovered(false); setSourceFrame(28); }} />
          </g>}
        </>}
      </svg>
      {ready !== 'ready' && <div className="bm1-terminal-art-status" role="status">
        {ready === 'loading' ? 'Loading original terminal artwork…' : 'Original terminal artwork is unavailable.'}
        {ready === 'failed' && <button type="button" onClick={() => setRetry(value => value + 1)}>Retry artwork</button>}
      </div>}
    </div>
    <details className="bm1-terminal-recovery"><summary>Browser recovery</summary>
      <p>Start a new session or load a saved game with these browser tools.</p>
      <button type="button" onClick={onReturnToMenu}>Return to menu</button>
      <button type="button" onClick={onRestart}>Restart current start</button>
      {saveTools}
    </details>
  </main>;
}
