/**
 * PixiJS adapter for the spatial game view.
 *
 * It owns every Pixi object it creates and exposes an explicit destroy path.
 * It reads state through the store and never mutates simulation values.
 */
import { Application, Assets, Container, Graphics, Sprite } from 'pixi.js';
import type { PlayerState } from '../simulation/model/player-state';
import type { GameModuleDefinition } from '../content/schemas/game-module';

export interface PixiGameView {
  destroy(): void;
}

/** Narrow read-only projection required by the renderer. */
export interface GameViewStateSource {
  getState(): { readonly player: PlayerState | null };
  subscribe(listener: (state: { readonly player: PlayerState | null }) => void): () => void;
}

export async function createPixiGameView(host: HTMLElement, store: GameViewStateSource, definition: GameModuleDefinition): Promise<PixiGameView> {
  const { width, height } = definition.viewport;
  const initialPlayer = store.getState().player;
  if (!initialPlayer) throw new Error('Cannot create a game view without an active player.');
  const visual = definition.visuals.find(candidate => candidate.entityDefinitionId === initialPlayer.entityDefinitionId);
  if (!visual) throw new Error('The active ship has no module visual.');
  // Load before allocating a renderer so an asset failure cannot leave a
  // partially initialized canvas attached to the scene host.
  const texture = await Assets.load(`/game/${visual.image}`);
  const application = new Application();
  await application.init({
    width,
    height,
    antialias: false,
    background: '#020713',
    resolution: window.devicePixelRatio,
    autoDensity: true,
  });
  host.appendChild(application.canvas);
  const scene = new Container();
  application.stage.addChild(scene);

  const stars = new Graphics();
  Array.from({ length: 90 }, (_, index) => ({
    x: (index * 97) % width,
    y: (index * 53) % height,
    radius: index % 7 === 0 ? 1.5 : 0.75,
  })).forEach(star => stars.circle(star.x, star.y, star.radius).fill({ color: 0xb7d9ff, alpha: 0.65 }));
  scene.addChild(stars);

  const playerSprite = new Sprite(texture);
  playerSprite.anchor.set(visual.anchor.x, visual.anchor.y);
  playerSprite.position.set(width / 2, height / 2);
  scene.addChild(playerSprite);

  const renderPlayer = (player: PlayerState): void => {
    playerSprite.rotation = player.rotationDegrees * Math.PI / 180;
    // Parallax gives immediate spatial feedback while planets/stations await
    // verified timeline placements. It has no simulation effect.
    stars.position.set(
      ((-player.position.x * 0.12) % width + width) % width - width,
      ((-player.position.y * 0.12) % height + height) % height - height,
    );
  };
  renderPlayer(store.getState().player ?? initialPlayer);
  const unsubscribe = store.subscribe(state => {
    if (state.player) renderPlayer(state.player);
  });

  return {
    destroy: () => {
      unsubscribe();
      application.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });
    },
  };
}
