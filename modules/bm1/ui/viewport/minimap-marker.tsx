/** Each selected marker owns a cosmetic frame clock. It never advances the
 * world, consumes RNG or survives unmount; deselection restores full alpha. */
import { useEffect, useState } from 'react';
import type { SpatialOverview } from '@engine/ui/spatial-overview-view';
import { minimapAlpha, minimapContent, minimapMarker } from './minimap-model';

export function MinimapMarker({
  entity,
  x,
  y,
  framesPerSecond,
}: {
  entity: SpatialOverview[number];
  x: number;
  y: number;
  framesPerSecond: number;
}) {
  const [elapsedFrames, setElapsedFrames] = useState(0);
  useEffect(() => {
    if (!entity.selected) return;
    const timer = setInterval(() => setElapsedFrames(frame => (frame + 1) % 5), 1000 / framesPerSecond);
    return () => clearInterval(timer);
  }, [entity.selected, framesPerSecond]);
  const marker = minimapMarker(entity, x, y);
  if (!marker) return null;
  const ink = minimapContent.frames[marker.frame - 1]!;
  return (
    <path
      d={ink.path}
      fill={ink.fill}
      stroke={ink.stroke}
      strokeWidth={ink.strokeWidth}
      transform={`translate(${marker.x} ${marker.y})`}
      opacity={minimapAlpha(entity.selected, Boolean(entity.cloaked), elapsedFrames)}
      data-minimap-frame={marker.frame}
      data-minimap-entity={entity.id}
    />
  );
}
