/**
 * PixiJS adapter for the spatial game view.
 *
 * It owns every Pixi object it creates and exposes an explicit destroy path.
 * It reads state through the store and never mutates simulation values.
 */
import { Application, Assets, Container, Graphics, Sprite } from 'pixi.js';
import { selectPlayerEntity, type WorldState } from '../simulation/model/world-state';
import type { GameModuleDefinition } from '../content/schemas/game-module';
import { worldToScreen } from './world-camera';
import { pickWorldTarget } from './world-hit-test';
import { createTransformHistory } from './transform-history';
import { createStarField } from './star-field';
import { createWorldEntitySprite, renderWorldEntitySprite } from './world-entity-sprite';
import { createPlayerBeamEffect } from './player-beam-effect';

export interface PixiGameView {
  /** Draw one display frame from completed world snapshots. */
  render(alpha: number): void;
  /** Rebase history after pause, restore or a lifecycle time reset. */
  reset(): void;
  destroy(): void;
}

/** Narrow read-only projection required by the renderer. */
export interface GameViewStateSource {
  getState(): { readonly world: WorldState | null; selectTarget(targetId: string | null): void };
  subscribe(listener: (state: { readonly world: WorldState | null }) => void): () => void;
}

export async function createPixiGameView(host: HTMLElement, store: GameViewStateSource, definition: GameModuleDefinition): Promise<PixiGameView> {
  const { width, height } = definition.viewport;
  const initialWorld = store.getState().world;
  const initialPlayer = initialWorld ? selectPlayerEntity(initialWorld) : null;
  if (!initialWorld || !initialPlayer) throw new Error('Cannot create a game view without an active player.');
  const visual = definition.visuals.entities.find(candidate => candidate.entityDefinitionId === initialPlayer.definitionId);
  if (!visual) throw new Error('The active ship has no module visual.');
  // Load before allocating a renderer so an asset failure cannot leave a
  // partially initialized canvas attached to the scene host.
  const initialPlanet = initialWorld?.entities.find(entity => entity.kind === 'planet');
  if (!initialPlanet) throw new Error('Cannot create a game view without a starting planet.');
  const system = definition.systems.find(candidate => candidate.id === initialPlanet.location.systemId);
  const planetVisual = definition.visuals.planets.find(candidate => candidate.visualTypeId === system?.planet.visualTypeId);
  if (!system || !planetVisual) throw new Error('The active planet has no module visual.');
  const stationVisuals = initialWorld.entities.filter(entity => entity.kind === 'station').map(station => {
    const mapping = definition.visuals.entities.find(candidate => candidate.entityDefinitionId === station.definitionId);
    if (!mapping) throw new Error(`Station ${station.stationId} has no module visual.`);
    return { station, mapping };
  });
  const npcVisuals = initialWorld.entities.filter(entity => entity.kind === 'npc-ship').map(npc => {
    const mapping = definition.visuals.entities.find(candidate => candidate.entityDefinitionId === npc.definitionId);
    if (!mapping) throw new Error(`NPC ${npc.id} has no module visual.`);
    return { npc, mapping };
  });
  const beamVisual = definition.visuals.weaponBeams.find(
    candidate => candidate.weaponDefinitionId === initialPlayer.armament.weaponDefinitionId,
  );
  const [texture, planetTexture, ...remainingTextures] = await Promise.all([
    Assets.load(`/game/${visual.image}`),
    Assets.load(`/game/${planetVisual.image}`),
    ...stationVisuals.map(({ mapping }) => Assets.load(`/game/${mapping.image}`)),
    ...npcVisuals.map(({ mapping }) => Assets.load(`/game/${mapping.image}`)),
    ...(beamVisual ? [Assets.load(`/game/${beamVisual.image}`)] : []),
  ]);
  const targetTextureCount = stationVisuals.length + npcVisuals.length;
  const targetTextures = remainingTextures.slice(0, targetTextureCount);
  const beamTexture = beamVisual ? remainingTextures[targetTextureCount] : null;
  const application = new Application();
  let initialized = false;
  let canvas: HTMLCanvasElement | null = null;
  let unsubscribe: (() => void) | null = null;
  let onPointerDown: ((event: PointerEvent) => void) | null = null;
  let destroyed = false;

  /**
   * Release only resources acquired by this view. Pixi's public Application
   * destroy path assumes that a renderer exists, so an init failure before
   * renderer assignment owns only the constructor-created stage.
   */
  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;

    let firstFailure: unknown;
    let cleanupFailed = false;
    const attempt = (cleanup: () => void): void => {
      try {
        cleanup();
      } catch (error) {
        if (cleanupFailed) return;
        firstFailure = error;
        cleanupFailed = true;
      }
    };

    if (canvas && onPointerDown) {
      const ownedCanvas = canvas;
      const ownedPointerDown = onPointerDown;
      attempt(() => ownedCanvas.removeEventListener('pointerdown', ownedPointerDown));
    }
    if (unsubscribe) attempt(unsubscribe);
    attempt(() => {
      const destroyOptions = { children: true, texture: false, textureSource: false } as const;
      // Pixi assigns `renderer` before running init plugins. Checking both
      // states also cleans a renderer when a later init plugin rejects.
      if (initialized || application.renderer) {
        application.destroy({ removeView: true }, destroyOptions);
        return;
      }
      application.stage.destroy(destroyOptions);
    });

    if (cleanupFailed) throw firstFailure;
  };

  try {
    await application.init({
      width,
      height,
      antialias: false,
      background: '#020713',
      resolution: window.devicePixelRatio,
      autoDensity: true,
    });
    initialized = true;
    canvas = application.canvas;
    // autoDensity allocates the DPR-scaled backing buffer and writes fixed
    // logical-pixel CSS dimensions. The host owns responsive display size:
    // replace only that inline CSS so world pixels and overlays scale together.
    // Keep the buffer and renderer's logical coordinates unchanged; pointer
    // picking below converts the displayed bounds back into those coordinates.
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    host.appendChild(canvas);
    const scene = new Container();
    application.stage.addChild(scene);

    // Stable scene layers make depth an ownership rule rather than an
    // incidental consequence of individual child insertion. In particular,
    // every background star remains below every planet and world entity.
    const backgroundLayer = new Container();
    const worldLayer = new Container();
    const effectLayer = new Container();
    const overlayLayer = new Container();
    scene.addChild(backgroundLayer);
    scene.addChild(worldLayer);
    scene.addChild(effectLayer);
    scene.addChild(overlayLayer);

    // Asset loading may span ticks; initialize all view histories at the same world.
    const currentWorld = store.getState().world ?? initialWorld;
    const stars = definition.starField ? createStarField(definition.starField, definition.viewport, currentWorld) : null;
    if (stars) backgroundLayer.addChild(stars.container);

    // Planet under ship: this explicit presentation order replaces timeline depth.
    const planetSprite = new Sprite(planetTexture);
    planetSprite.anchor.set(planetVisual.pivot.x, planetVisual.pivot.y);
    planetSprite.width = planetVisual.nativeSize.width * system.planet.displayScalePercent / 100;
    planetSprite.height = planetVisual.nativeSize.height * system.planet.displayScalePercent / 100;
    worldLayer.addChild(planetSprite);

    // Layer order remains explicit: station, NPC, player, then selection ring.
    // Station depth relative to the player is provisional until the original
    // display hierarchy is recovered; all spatial positions share one camera.
    const stationSprites = stationVisuals.map(({ station, mapping }, index) => {
      return createWorldEntitySprite(station.id, mapping, targetTextures[index]!);
    });
    stationSprites.forEach(({ sprite }) => worldLayer.addChild(sprite));

    const npcSprites = npcVisuals.map(({ npc, mapping }, index) => {
      return createWorldEntitySprite(npc.id, mapping, targetTextures[stationVisuals.length + index]!);
    });
    npcSprites.forEach(({ sprite }) => worldLayer.addChild(sprite));
    const selectableSprites = [...stationSprites, ...npcSprites];

    const playerSprite = new Sprite(texture);
    playerSprite.anchor.set(visual.pivot.x, visual.pivot.y);
    playerSprite.width = visual.nativeSize.width;
    playerSprite.height = visual.nativeSize.height;
    worldLayer.addChild(playerSprite);

    const playerBeam = beamVisual && beamTexture
      ? createPlayerBeamEffect(beamVisual, beamTexture, currentWorld) : null;
    if (playerBeam) effectLayer.addChild(playerBeam.sprite);

    // A view-only marker follows the same selected world ID as the React panel.
    // Its circle approximates sprite bounds; source vector artwork remains open.
    const selectedRing = new Graphics().circle(0, 0, 1).stroke({ color: 0xffd36a, width: 0.08 });
    selectedRing.visible = false;
    overlayLayer.addChild(selectedRing);

    const history = createTransformHistory(currentWorld);
    let cameraZoom = currentWorld.cameraZoom;
    let selectedTargetEntityId = currentWorld.selectedTargetEntityId;
    const render = (alpha: number): void => {
      const player = history.sample(initialWorld.playerEntityId, alpha);
      if (!player) return;
      const cameraAnchor = definition.viewport.cameraAnchor ?? { x: width / 2, y: height / 2 };
      playerSprite.position.set(cameraAnchor.x, cameraAnchor.y);
      playerSprite.width = visual.nativeSize.width / cameraZoom;
      playerSprite.height = visual.nativeSize.height / cameraZoom;
      const planet = history.sample(initialPlanet.id, alpha);
      planetSprite.visible = planet !== null;
      if (planet) {
        const position = worldToScreen(planet, player, definition.viewport, cameraZoom);
        planetSprite.position.set(position.x, position.y);
        planetSprite.width = planetVisual.nativeSize.width * system.planet.displayScalePercent / 100 / cameraZoom;
        planetSprite.height = planetVisual.nativeSize.height * system.planet.displayScalePercent / 100 / cameraZoom;
      }
      selectableSprites.forEach(binding => {
        renderWorldEntitySprite(
          binding,
          history.sample(binding.entityId, alpha),
          player,
          definition.viewport,
          cameraZoom,
        );
      });
      const selected = selectableSprites.find(({ entityId }) => entityId === selectedTargetEntityId);
      const selectedTransform = selected ? history.sample(selected.entityId, alpha) : null;
      selectedRing.visible = selectedTransform !== null;
      if (selected && selectedTransform) {
        const position = worldToScreen(selectedTransform, player, definition.viewport, cameraZoom);
        const nativeDiameter = Math.max(selected.visual.nativeSize.width, selected.visual.nativeSize.height);
        selectedRing.position.set(position.x, position.y);
        selectedRing.scale.set((nativeDiameter / 2 + 8) / cameraZoom);
      }
      playerSprite.rotation = player.rotationDegrees * Math.PI / 180;
      playerBeam?.render(alpha, history, player, definition.viewport, cameraZoom);
      stars?.render(alpha);
    };
    render(1);
    unsubscribe = store.subscribe(state => {
      if (!state.world) return;
      cameraZoom = state.world.cameraZoom;
      selectedTargetEntityId = state.world.selectedTargetEntityId;
      playerBeam?.advance(state.world, history);
      history.advance(state.world);
      stars?.advance(state.world);
    });

    onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      const world = store.getState().world;
      if (!world) return;
      const bounds = canvas!.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const point = {
        x: (event.clientX - bounds.left) * width / bounds.width,
        y: (event.clientY - bounds.top) * height / bounds.height,
      };
      store.getState().selectTarget(pickWorldTarget(point, world, definition));
    };
    canvas.addEventListener('pointerdown', onPointerDown);

    return {
      render,
      reset: () => {
        const world = store.getState().world;
        if (!world) return;
        cameraZoom = world.cameraZoom;
        history.reset(world);
        stars?.reset(world);
        playerBeam?.reset(world);
        render(1);
      },
      destroy,
    };
  } catch (error) {
    // Cleanup failures must not replace the creation failure that callers use
    // for diagnostics. `destroy` still attempts every acquired resource.
    try {
      destroy();
    } catch {
      // The original initialization/setup error remains authoritative.
    }
    throw error;
  }
}
