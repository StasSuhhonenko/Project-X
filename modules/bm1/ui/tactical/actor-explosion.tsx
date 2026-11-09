/** Six source frames, independently queued for every committed ship/station death. */
import { useEffect, useRef, useState } from 'react';
import type { PixiSceneDefinition } from '@engine/rendering/pixi/configuration';
import { entityVisualSize } from '@engine/rendering/pixi/entity-visual-size';
import { worldToScreen } from '@engine/rendering/shared/world-camera';
import type { ActorDeathEvent } from '@engine/simulation/model/actor-death-event';
import { observeActorDeaths, type ActorDeathSource } from '@engine/ui/actor-death-source';
import type { GameHudView } from '@engine/ui/game-hud-view';
import { runtimeAssetUrl } from '../runtime-assets';

export const actorExplosionAssets = Object.freeze(
  Array.from({ length: 6 }, (_, index) => `actor-explosion-${21 + index}.svg`)
);
export const actorExplosionAsset = (file: string) => runtimeAssetUrl(`assets/actor-explosion/${file}`);

/** The recovered final bitmap averages about 100 logical pixels across its two
 * axes. Normalize that footprint to the actor's average unrotated dimensions.
 * This preserves the six captured poses, rather than inventing a growth curve
 * for the original nested explosionwave timeline. Units are world pixels. */
export function actorExplosionSize(definition: PixiSceneDefinition, definitionId: number): number | null {
  const visual = definition.visuals.entities.find(item => item.entityDefinitionId === definitionId);
  if (!visual) return null;
  const size = entityVisualSize(visual);
  return (size.width + size.height) / 2;
}

type Explosion = { readonly event: ActorDeathEvent; readonly epoch: number };

/** Subscription receives every publication before React can coalesce ticks.
 * Queued effects own wall-clock paint only; neither selection nor notice text
 * participates. Restore/remount seeds a baseline and disposal drops the queue. */
export function ActorExplosion({
  source,
  hud,
  available,
  definition,
}: {
  readonly source?: ActorDeathSource | undefined;
  readonly hud: GameHudView;
  readonly available: boolean;
  readonly definition: PixiSceneDefinition;
}) {
  const enabled = useRef(available);
  enabled.current = available;
  const [effects, setEffects] = useState<readonly Explosion[]>([]);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!source) return;
    return observeActorDeaths(source, events => {
      if (!enabled.current) return;
      const epoch = performance.now();
      setNow(epoch);
      setEffects(previous => [...previous, ...events.map(event => ({ event, epoch }))]);
    });
  }, [source]);
  useEffect(() => {
    if (!effects.length) return;
    const timer = window.setInterval(() => {
      const time = performance.now();
      setNow(time);
      setEffects(previous => previous.filter(effect => (time - effect.epoch) * 13 < 6000));
    }, 1000 / 13);
    return () => window.clearInterval(timer);
  }, [effects.length]);
  if (!available) return null;
  return <ActorExplosionFrames effects={effects} now={now} hud={hud} definition={definition} />;
}

/** Pure paint boundary; timing/subscription ownership stays in ActorExplosion. */
export function ActorExplosionFrames({
  effects,
  now,
  hud,
  definition,
}: {
  readonly effects: readonly Explosion[];
  readonly now: number;
  readonly hud: GameHudView;
  readonly definition: PixiSceneDefinition;
}) {
  if (!effects.length) return null;
  return (
    <svg className="bm1-hud-stage" viewBox="0 0 600 450" aria-label="Destroyed actor explosions">
      {effects.map(({ event, epoch }) => {
        const size = actorExplosionSize(definition, event.definitionId);
        if (size === null) return null;
        const frame = 21 + Math.min(5, Math.floor((Math.max(0, now - epoch) * 13) / 1000));
        const position = worldToScreen(
          event.position,
          { x: hud.positionX, y: hud.positionY },
          definition.viewport,
          hud.zoom
        );
        return (
          <g
            key={event.actorEntityId}
            data-actor-id={event.actorEntityId}
            data-explosion-frame={frame}
            transform={`translate(${position.x} ${position.y}) scale(${size / 100 / hud.zoom})`}
          >
            <image
              href={actorExplosionAsset(`actor-explosion-${frame}.svg`)}
              x="-300"
              y="-225"
              width="600"
              height="450"
            />
          </g>
        );
      })}
    </svg>
  );
}
