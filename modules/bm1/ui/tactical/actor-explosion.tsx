/** Passive source explosion paint, local to a committed selected-actor death. */
import { useEffect, useRef, useState } from 'react';
import { runtimeAssetUrl } from '../runtime-assets';
import type { GameHudView } from '../../../../src/ui/game-hud-view';
import type { SelectedTargetView } from '../../../../src/ui/selected-target-view';
import type { PlayerSpatialView } from '../../../../src/ui/player-spatial-view';
import type { GameModuleDefinition } from '../../../../src/content/schemas/game-module';
import { worldToScreen } from '../../../../src/rendering/world-camera';

export const actorExplosionAssets = Object.freeze(Array.from({ length: 6 }, (_, index) => `actor-explosion-${21 + index}.svg`));
export const actorExplosionAsset = (file: string) => runtimeAssetUrl(`assets/actor-explosion/${file}`);

/** The host remounts gameplay per scene/session. No queue, animation phase or
 * previous actor enters authoritative state. New notice plus selection loss is
 * required, so dismissal, travel and restored notices cannot invent an effect.
 * Position uses last committed target geometry; no per-render interpolation or
 * native cross-clip timing equivalence is asserted. */
export function ActorExplosion({ target, hud, spatial, available, definition }: {
  readonly target: SelectedTargetView | null; readonly hud: GameHudView;
  readonly spatial: PlayerSpatialView; readonly available: boolean;
  readonly definition: GameModuleDefinition;
}) {
  const previous = useRef({ target, notice: hud.noticeSequence, spatial });
  const [effect, setEffect] = useState<{ x: number; y: number; zoom: number; epoch: number } | null>(null);
  const [frame, setFrame] = useState(21);
  useEffect(() => {
    const before = previous.current;
    previous.current = { target, notice: hud.noticeSequence, spatial };
    if (!available || target || !before.target || hud.noticeCode !== 'actor-destroyed' || hud.noticeSequence === before.notice) return;
    setFrame(21);
    const position = worldToScreen({ x: before.target.relativeX, y: before.target.relativeY },
      { x: 0, y: 0 }, definition.viewport, before.spatial.zoom);
    setEffect({ ...position,
      zoom: before.spatial.zoom, epoch: performance.now() });
  }, [target, hud.noticeCode, hud.noticeSequence, spatial, available, definition]);
  useEffect(() => {
    if (!effect) return;
    const timer = window.setInterval(() => {
      const next = 21 + Math.floor((performance.now() - effect.epoch) * 13 / 1000);
      if (next > 26) { setEffect(null); return; }
      setFrame(next);
    }, 1000 / 13);
    return () => window.clearInterval(timer);
  }, [effect]);
  if (!available || !effect) return null;
  return <svg className="bm1-hud-stage" viewBox="0 0 600 450" aria-label="Destroyed actor explosion" data-explosion-frame={frame}>
    <g transform={`translate(${effect.x} ${effect.y}) scale(${1 / effect.zoom})`}>
      <image href={actorExplosionAsset(`actor-explosion-${frame}.svg`)} x="-300" y="-225" width="600" height="450" />
    </g>
  </svg>;
}
