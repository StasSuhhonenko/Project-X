/**
 * PixiJS adapter for the spatial game view.
 *
 * It owns every Pixi object it creates and exposes an explicit destroy path.
 * It reads state through the store and never mutates simulation values.
 */
import { Application, Assets, Container, Rectangle, Sprite } from 'pixi.js';
import {
  selectPlayerEntity,
  type NpcShipEntity,
  type StationEntity,
  type WorldState,
} from '../../simulation/model/world-state';
import { entityVisualSize } from '../pixi/entity-visual-size';
import { createActorOpacity } from '../shared/actor-opacity';
import { ParallaxLayerSchema, type ParallaxLayer } from '../shared/parallax-layer';
import { playerGeometry } from '../shared/player-geometry';
import { createPresentationTiming, type PresentationFrame } from '../shared/presentation-timing';
import { createTransformHistory, type PresentationTransform } from '../shared/transform-history';
import { worldToScreen } from '../shared/world-camera';
import { createActorDepartureEffects, type ActorDepartureEffects } from './actor-departure-effects';
import { createActorWrecks, type ActorWrecks } from './actor-wrecks';
import type { PixiSceneDefinition as GameModuleDefinition } from './configuration';
import { actorVisual, createConstructionSiteAnimation } from './construction-site-visual';
import { createDamageMaskEffects, type DamageMaskEffects } from './damage-mask-effects';
import { createNpcBeamEffects } from './npc-beam-effects';
import { createPlayerBeamEffect } from './player-beam-effect';
import { createProjectileEffects } from './projectile-effects';
import { sceneAssetPaths } from './scene-asset-paths';
import { createSelectionMarker } from './selection-marker';
import { createShieldFlashEffects, type ShieldFlashEffects } from './shield-flash-effects';
import { createSpecialEffects } from './special-effects';
import { createStarField } from './star-field';
import type { StarFieldContinuity } from './star-field-history';
import { createWorldEntitySprite, renderWorldEntitySprite } from './world-entity-sprite';
import { pickWorldContact, type PresentedTargetFrame } from './world-hit-test';

export interface PixiGameView {
  /** Draw one display frame from completed world snapshots. */
  render(alpha: number, frame?: PresentationFrame): void;
  /** Rebase history after pause, restore or a lifecycle time reset. */
  reset(): void;
  /** Presentation-only actor replacement; never changes authoritative entities. */
  setPlayerVisible(visible: boolean): void;
  /** One frozen logical-viewport PNG without the player; owns no new live scene. */
  captureBackdrop(): string | null;
  /** The frame as last displayed, as a detached canvas (see SpatialView). */
  captureStill(): import('../contracts/spatial-presentation').SpatialStill | null;
  destroy(): void;
}

/** Narrow read-only projection required by the renderer. */
export interface GameViewStateSource {
  getState(): {
    readonly world: WorldState | null;
    readonly sessionRevision: number;
    selectTarget(targetId: string | null): void;
  };
  subscribe(
    listener: (state: { readonly world: WorldState | null; readonly sessionRevision: number }) => void
  ): () => void;
}

/**
 * Host-owned relay between consecutive views of one presentation. `take`
 * returns the live or last view's field state; `register` publishes this
 * view's state and returns a release that keeps a final snapshot on destroy.
 */
export interface StarFieldHandoff {
  take(): StarFieldContinuity | null;
  register(read: () => StarFieldContinuity): () => void;
}

/** Optional host presentation hooks; no module identity or mechanics enter Pixi. */
export interface GameViewOptions {
  /** Trusted selected-module artwork in logical viewport coordinates. Loaded
   * before allocating Pixi; owned by the same scene and backdrop capture. */
  readonly backgroundImage?: string;
  readonly parallaxLayers?: readonly ParallaxLayer[];
  /** Continues the star field (and so the scroll that places parallax layers)
   * across a view replacement in the same scene, such as a purchase remount. */
  readonly starFieldHandoff?: StarFieldHandoff;
  readonly onActivate?: (
    contact: {
      readonly id: string;
      readonly kind: 'planet' | 'station' | 'npc-ship';
      readonly selectedBefore: boolean;
      readonly construction?: 'pending';
    } | null
  ) => void;
}

export async function createPixiGameView(
  host: HTMLElement,
  store: GameViewStateSource,
  definition: GameModuleDefinition,
  options: GameViewOptions = {}
): Promise<PixiGameView> {
  const { width, height } = definition.viewport;
  const initialState = store.getState();
  const initialWorld = initialState.world;
  const sessionRevision = initialState.sessionRevision;
  const initialPlayer = initialWorld ? selectPlayerEntity(initialWorld) : null;
  if (!initialWorld || !initialPlayer) throw new Error('Cannot create a game view without an active player.');
  const visual = definition.visuals.entities.find(
    candidate => candidate.entityDefinitionId === initialPlayer.definitionId
  );
  if (!visual) throw new Error('The active ship has no module visual.');
  // Load before allocating a renderer so an asset failure cannot leave a
  // partially initialized canvas attached to the scene host.
  const initialPlanet = initialWorld?.entities.find(entity => entity.kind === 'planet');
  if (!initialPlanet) throw new Error('Cannot create a game view without a starting planet.');
  const playerEntityId = initialPlayer.id;
  const planetEntityId = initialPlanet.id;
  const sceneSystemId = initialPlayer.location.systemId;
  /** Store publication precedes React replacement: the old view owns no new scene. */
  const ownsState = (state: { readonly world: WorldState | null; readonly sessionRevision: number }): boolean => {
    if (!state.world || state.sessionRevision !== sessionRevision || state.world.playerEntityId !== playerEntityId)
      return false;
    // A purchase keeps player identity but replaces its visual/capabilities.
    // The retiring view must not pick/render the replacement using old bounds.
    if (selectPlayerEntity(state.world).definitionId !== initialPlayer.definitionId) return false;
    return state.world.entities.some(
      entity => entity.kind === 'planet' && entity.id === planetEntityId && entity.location.systemId === sceneSystemId
    );
  };
  const system = definition.systems.find(candidate => candidate.id === initialPlanet.location.systemId);
  const planetVisual = definition.visuals.planets.find(
    candidate => candidate.visualTypeId === system?.planet.visualTypeId
  );
  if (!system || !planetVisual) throw new Error('The active planet has no module visual.');
  const stationVisuals = initialWorld.entities
    .filter(entity => entity.kind === 'station')
    .map(station => {
      const mapping = actorVisual(definition, station);
      if (!mapping) throw new Error(`Station ${station.stationId} has no module visual.`);
      return { station, mapping };
    });
  const npcVisuals = initialWorld.entities
    .filter(entity => entity.kind === 'npc-ship')
    .map(npc => {
      const mapping = definition.visuals.entities.find(candidate => candidate.entityDefinitionId === npc.definitionId);
      if (!mapping) throw new Error(`NPC ${npc.id} has no module visual.`);
      return { npc, mapping };
    });
  const paths = sceneAssetPaths(initialWorld, definition);
  const parallaxLayers = (options.parallaxLayers ?? []).map(layer => ParallaxLayerSchema.parse(layer));
  const loadedTextures = await Promise.all([
    ...paths.map(path => Assets.load(`/game/${path}`)),
    ...(options.backgroundImage ? [Assets.load(options.backgroundImage)] : []),
    ...parallaxLayers.map(layer => Assets.load(layer.image)),
  ]);
  const backgroundTexture = options.backgroundImage ? loadedTextures[paths.length]! : null;
  const textures = new Map(paths.map((path, index) => [path, loadedTextures[index]!]));
  const texture = textures.get(visual.image)!;
  const planetTexture = textures.get(planetVisual.image)!;
  const application = new Application();
  let initialized = false;
  let canvas: HTMLCanvasElement | null = null;
  let unsubscribe: (() => void) | null = null;
  let onPointerDown: ((event: PointerEvent) => void) | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let destroyed = false;
  let shieldFlash: ShieldFlashEffects | null = null;
  let releaseStarField: (() => void) | null = null;
  let damageMask: DamageMaskEffects | null = null;
  let departures: ActorDepartureEffects | null = null;
  let wrecks: ActorWrecks | null = null;
  let resolutionDirty = false;
  let devicePixelRatio = window.devicePixelRatio || 1;
  /** Logical geometry stays fixed; rasterize at the host's displayed size.
   * CSS-only enlargement of a logical-sized canvas loses subpixel star motion.
   * A hidden/zero-sized host retains at least its logical backing resolution. */
  const displayResolution = (): number => {
    const bounds = host.getBoundingClientRect?.();
    const scale = bounds ? Math.max(1, Math.min(bounds.width / width, bounds.height / height)) : 1;
    return devicePixelRatio * scale;
  };

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
    if (releaseStarField) attempt(releaseStarField);
    if (unsubscribe) attempt(unsubscribe);
    if (resizeObserver) attempt(() => resizeObserver!.disconnect());
    // The shared flash filter is not a display child; release it explicitly.
    if (shieldFlash) attempt(() => shieldFlash!.destroy());
    // Mask Graphics are display children; detach them from sprites first.
    if (damageMask) attempt(() => damageMask!.destroy());
    if (departures) attempt(() => departures!.destroy());
    if (wrecks) attempt(() => wrecks!.clear());
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
      antialias: true,
      background: backgroundTexture ? '#000000' : '#020713',
      resolution: displayResolution(),
      autoDensity: true,
    });
    initialized = true;
    canvas = application.canvas;
    // autoDensity allocates the DPR-scaled backing buffer and writes fixed
    // logical-pixel CSS dimensions. The host owns responsive display size:
    // replace only that inline CSS so world pixels and overlays scale together.
    // Logical coordinates remain unchanged. The backing buffer follows host
    // size; pointer picking converts displayed bounds back to logical pixels.
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    host.appendChild(canvas);
    if (typeof ResizeObserver !== 'undefined') {
      // Observer work only flags a change. Allocation happens inside the guarded
      // display-frame path, so a renderer failure reaches normal scene recovery.
      resizeObserver = new ResizeObserver(() => {
        resolutionDirty = true;
      });
      resizeObserver.observe(host);
    }
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
    if (backgroundTexture) {
      const backdrop = new Sprite(backgroundTexture);
      backdrop.width = width;
      backdrop.height = height;
      backgroundLayer.addChild(backdrop);
    }

    // Asset loading may span ticks; initialize all view histories at the same world.
    const latestState = store.getState();
    const currentWorld = ownsState(latestState) ? latestState.world! : initialWorld;
    const parallaxSprites = parallaxLayers.map((layer, index) => {
      const sprite = new Sprite(loadedTextures[paths.length + (options.backgroundImage ? 1 : 0) + index]!);
      sprite.anchor.set(0.5);
      sprite.width = layer.width;
      sprite.height = layer.height;
      backgroundLayer.addChild(sprite);
      return { layer, sprite };
    });
    const stars = createStarField(
      definition.starField ?? {
        boundary: 'wrap',
        seed: 0,
        color: 0xffffff,
        alpha: 0,
        stars: [],
      },
      definition.viewport,
      currentWorld,
      options.starFieldHandoff?.take() ?? null
    );
    releaseStarField = options.starFieldHandoff?.register(stars.snapshot) ?? null;
    backgroundLayer.addChild(stars.container);

    // Planet under ship: this explicit presentation order replaces timeline depth.
    const planetSprite = new Sprite(planetTexture);
    planetSprite.anchor.set(planetVisual.pivot.x, planetVisual.pivot.y);
    planetSprite.width = (planetVisual.nativeSize.width * system.planet.displayScalePercent) / 100;
    planetSprite.height = (planetVisual.nativeSize.height * system.planet.displayScalePercent) / 100;
    worldLayer.addChild(planetSprite);

    // Layer order remains explicit: station, NPC, player, then selection ring.
    // This matches the BM1 source depths (stations/NPCs in slot depths from 1,
    // the player attached at 300, shots from 301); all positions share one camera.
    const createActorBinding = (
      actor: StationEntity | NpcShipEntity,
      mapping: NonNullable<ReturnType<typeof actorVisual>>
    ) => {
      const actorTexture = textures.get(mapping.image);
      if (!actorTexture) throw new Error('Committed scene actor has no preloaded visual.');
      const binding = createWorldEntitySprite(actor.id, mapping, actorTexture);
      const animation =
        actor.kind === 'station' && actor.construction === 'pending'
          ? definition.visuals.constructionSite?.animation
          : undefined;
      if (!animation) return { ...binding, rotationDegrees: mapping.rotationDegrees, display: binding.sprite, site: null };
      // Group the scaffold and overlays at the same world depth. The sprite
      // remains the ordinary fit/picking reference, while the pod art can
      // travel outside its bounds without adding any contact geometry.
      const display = new Container();
      const site = createConstructionSiteAnimation(animation, textures);
      display.addChild(binding.sprite);
      display.addChild(site.container);
      return { ...binding, rotationDegrees: mapping.rotationDegrees, display, site };
    };
    const stationSprites = stationVisuals.map(({ station, mapping }) => createActorBinding(station, mapping));
    stationSprites.forEach(({ display }) => worldLayer.addChild(display));
    const npcSprites = npcVisuals.map(({ npc, mapping }) => createActorBinding(npc, mapping));
    npcSprites.forEach(({ display }) => worldLayer.addChild(display));
    let selectableSprites = [...stationSprites, ...npcSprites];

    const playerSprite = new Sprite(texture);
    playerSprite.anchor.set(visual.pivot.x, visual.pivot.y);
    const playerSize = entityVisualSize(visual, 'player');
    playerSprite.width = playerSize.width;
    playerSprite.height = playerSize.height;
    worldLayer.addChild(playerSprite);

    /**
     * A committed scene can gain or lose actors without being remounted. Bind
     * fresh IDs to preloaded textures and release dead sprites immediately,
     * preserving planet/station/NPC/player depth and shared texture ownership.
     * No actor snapshot, asynchronous load or simulation setter enters a binding.
     */
    const synchronizeWorldSprites = (world: WorldState): void => {
      const actors = world.entities.filter(entity => entity.kind === 'station' || entity.kind === 'npc-ship');
      const liveIds = new Set(actors.map(entity => entity.id));
      selectableSprites = selectableSprites.filter(binding => {
        if (liveIds.has(binding.entityId)) return true;
        // A destroyed actor's hull may stay under its explosion for a while.
        if (binding.site) {
          binding.display.destroy({ children: true, texture: false, textureSource: false });
          return false;
        }
        if (!wrecks?.adopt(binding, world)) binding.sprite.destroy({ texture: false, textureSource: false });
        return false;
      });
      const boundIds = new Set(selectableSprites.map(binding => binding.entityId));
      actors
        .filter(actor => !boundIds.has(actor.id))
        .forEach(actor => {
          const mapping = actorVisual(definition, actor);
          if (!mapping) throw new Error('Committed scene actor has no preloaded visual.');
          const binding = createActorBinding(actor, mapping);
          worldLayer.addChildAt(binding.display, worldLayer.getChildIndex(playerSprite));
          selectableSprites.push(binding);
        });
    };
    // Asset loading may have spanned a death; reconcile the latest committed set
    // before exposing the first frame as ready.
    wrecks = createActorWrecks(definition);
    synchronizeWorldSprites(currentWorld);

    const beamEffects = definition.visuals.weaponBeams
      .filter(beam => textures.has(beam.image))
      .flatMap(beam =>
        Array.from({ length: definition.equipment ? 3 : 1 }, (_, channel) =>
          createPlayerBeamEffect(beam, textures.get(beam.image)!, currentWorld, textures, channel)
        )
      );
    beamEffects.forEach(beam => beam.sprites.forEach(sprite => effectLayer.addChild(sprite)));
    const npcBeams = createNpcBeamEffects(currentWorld, definition, textures, effectLayer);
    const projectiles =
      definition.visuals.weaponProjectiles.some(visual => textures.has(visual.image)) || currentWorld.projectiles.length
        ? createProjectileEffects(currentWorld, definition, textures)
        : null;
    if (projectiles) effectLayer.addChild(projectiles.container);
    const specialEffects = createSpecialEffects(currentWorld, definition, textures, effectLayer);
    const actorOpacity = createActorOpacity(currentWorld, definition.visuals.cloak);
    shieldFlash = createShieldFlashEffects(currentWorld, definition, textures, worldLayer);
    damageMask = createDamageMaskEffects(currentWorld, definition, worldLayer);
    departures = createActorDepartureEffects(currentWorld, definition, textures, worldLayer);

    // A view-only marker follows the same selected world ID as the React panel.
    const selectionMarker = createSelectionMarker(definition, overlayLayer);

    const history = createTransformHistory(currentWorld);
    let cameraZoom = currentWorld.cameraZoom;
    let selectedTargetEntityId = currentWorld.selectedTargetEntityId;
    let presentedFrame: PresentedTargetFrame;
    const timing = createPresentationTiming();
    const render: PixiGameView['render'] = (alpha, frame) => {
      if (resolutionDirty || devicePixelRatio !== (window.devicePixelRatio || 1)) {
        resolutionDirty = false;
        devicePixelRatio = window.devicePixelRatio || 1;
        const resolution = displayResolution();
        if (resolution !== application.renderer.resolution) {
          application.renderer.resize(width, height, resolution);
          canvas!.style.width = '100%';
          canvas!.style.height = '100%';
        }
      }
      const sample = timing.sample(alpha, frame);
      if (sample.rebaseHistory) {
        const world = store.getState().world;
        if (world) history.reset(world);
      }
      // A locked world has no new interval to interpolate. Reusing the running
      // fixed-loop alpha here would replay its last movement every source tick.
      alpha = sample.alpha;
      const player = history.sample(playerEntityId, alpha);
      if (!player) return;
      const scroll = stars.render(alpha);
      // The camera tracks the interpolated player, including during the
      // player's departure artwork: the world keeps advancing beneath it.
      const camera = player;
      const geometry = playerGeometry(definition.viewport, playerSize, player.rotationDegrees, cameraZoom);
      playerSprite.position.set(geometry.x, geometry.y);
      playerSprite.width = geometry.width;
      playerSprite.height = geometry.height;
      playerSprite.alpha = actorOpacity.sample(playerEntityId, alpha);
      const planet = history.sample(planetEntityId, alpha);
      planetSprite.visible = planet !== null;
      if (planet) {
        const position = worldToScreen(planet, camera, definition.viewport, cameraZoom);
        planetSprite.position.set(position.x, position.y);
        planetSprite.width = (planetVisual.nativeSize.width * system.planet.displayScalePercent) / 100 / cameraZoom;
        planetSprite.height = (planetVisual.nativeSize.height * system.planet.displayScalePercent) / 100 / cameraZoom;
      }
      const presentedTransforms = new Map<string, PresentationTransform>();
      const nowMs = definition.visuals.constructionSite?.animation ? performance.now() : 0;
      selectableSprites.forEach(binding => {
        binding.sprite.alpha = actorOpacity.sample(binding.entityId, alpha);
        const sampled = history.sample(binding.entityId, alpha);
        const transform =
          sampled && binding.rotationDegrees !== undefined
            ? { ...sampled, rotationDegrees: binding.rotationDegrees }
            : sampled;
        if (transform) presentedTransforms.set(binding.entityId, transform);
        renderWorldEntitySprite(binding, transform, camera, definition.viewport, cameraZoom);
        binding.site?.render(nowMs, binding.sprite, cameraZoom);
      });
      const selected = selectableSprites.find(({ entityId }) => entityId === selectedTargetEntityId);
      const selectedTransform = selected ? presentedTransforms.get(selected.entityId) : undefined;
      selectionMarker.render(
        selected && selectedTransform
          ? {
              entityId: selected.entityId,
              visual: selected.visual,
              rotationDegrees: selectedTransform.rotationDegrees,
              screen: worldToScreen(selectedTransform, camera, definition.viewport, cameraZoom),
            }
          : null,
        cameraZoom,
        performance.now()
      );
      playerSprite.rotation = (player.rotationDegrees * Math.PI) / 180;
      wrecks?.render(camera, cameraZoom);
      // Warp-out replaces the ordinary actor drawing before masks/overlays read it.
      departures?.render(selectableSprites, alpha, cameraZoom);
      // A warping actor shows only its hull or flash: no damage mask or shield flash.
      const ordinarySprites = selectableSprites.filter(binding => !departures?.isDeparting(binding.entityId));
      // After every actor sprite is final for this frame, so masks and overlays mirror it.
      damageMask?.render([
        { entityId: playerEntityId, visual, sprite: playerSprite, role: 'player' },
        ...ordinarySprites.map(binding => ({ ...binding, role: 'world' as const })),
      ]);
      shieldFlash?.render([
        { entityId: playerEntityId, visual, sprite: playerSprite, role: 'player' },
        ...ordinarySprites.map(binding => ({ ...binding, role: 'world' as const })),
      ]);
      beamEffects.forEach(beam => beam.render(alpha, history, camera, definition.viewport, cameraZoom));
      npcBeams.render(alpha, history, camera, definition.viewport, cameraZoom);
      projectiles?.render(alpha, camera, cameraZoom);
      specialEffects.render(alpha, history, camera, cameraZoom);
      parallaxSprites.forEach(({ sprite, layer }) =>
        sprite.position.set(layer.x + scroll.x * layer.parallax, layer.y + scroll.y * layer.parallax)
      );
      timing.didDraw(alpha);
      // Pointer events may arrive after another simulation tick. Keep the
      // exact samples just drawn rather than resampling advanced history.
      presentedFrame = {
        player: camera,
        zoom: cameraZoom,
        transforms: presentedTransforms,
        ...(planet ? { planet } : {}),
      };
    };
    render(1);
    unsubscribe = store.subscribe(state => {
      if (!state.world || !ownsState(state)) return;
      wrecks?.advance(state.world);
      synchronizeWorldSprites(state.world);
      cameraZoom = state.world.cameraZoom;
      selectedTargetEntityId = state.world.selectedTargetEntityId;
      beamEffects.forEach(beam => beam.advance(state.world!, history));
      npcBeams.advance(state.world!, history);
      projectiles?.advance(state.world);
      specialEffects.advance(state.world);
      actorOpacity.advance(state.world);
      shieldFlash?.advance(state.world);
      damageMask?.advance(state.world);
      departures?.advance(state.world);
      history.advance(state.world);
      stars?.advance(state.world);
    });

    onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      const state = store.getState();
      const world = state.world;
      if (!world || !ownsState(state)) return;
      const bounds = canvas!.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const point = {
        x: ((event.clientX - bounds.left) * width) / bounds.width,
        y: ((event.clientY - bounds.top) * height) / bounds.height,
      };
      const contact = pickWorldContact(point, world, definition, presentedFrame);
      if (!contact?.construction)
        store.getState().selectTarget(contact?.kind === 'planet' ? null : (contact?.id ?? null));
      options.onActivate?.(
        contact ? { ...contact, selectedBefore: world.selectedTargetEntityId === contact.id } : null
      );
    };
    canvas.addEventListener('pointerdown', onPointerDown);

    return {
      render,
      captureBackdrop: () => {
        if (destroyed) return null;
        render(1);
        const wasVisible = playerSprite.visible;
        playerSprite.visible = false;
        // The backdrop excludes the player, including any flash over it; the
        // next normal render recomputes the overlay from tracker state.
        shieldFlash?.hide(playerEntityId);
        try {
          return (
            application.renderer.extract
              .canvas({
                target: application.stage,
                frame: new Rectangle(0, 0, width, height),
                resolution: 1,
                clearColor: '#020713',
              })
              .toDataURL?.('image/png') ?? null
          );
        } finally {
          // Capture must never leave the normal renderer's actor hidden.
          playerSprite.visible = wasVisible;
        }
      },
      captureStill: () => {
        if (destroyed) return null;
        render(timing.lastDrawnAlpha());
        const bounds = application.canvas.getBoundingClientRect();
        const image = application.renderer.extract.canvas({
          target: application.stage,
          frame: new Rectangle(0, 0, width, height),
          resolution: 1,
          clearColor: '#020713',
        }) as HTMLCanvasElement;
        return { image, bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } };
      },
      setPlayerVisible: visible => {
        playerSprite.visible = visible;
        // Redraw the displayed fraction so hiding the actor never snaps the
        // backdrop/planet ahead to the next completed tick.
        render(timing.lastDrawnAlpha());
      },
      reset: () => {
        const state = store.getState();
        const world = state.world;
        if (!world || !ownsState(state)) return;
        cameraZoom = world.cameraZoom;
        wrecks?.clear();
        history.reset(world);
        stars?.reset(world);
        beamEffects.forEach(beam => beam.reset(world));
        npcBeams.reset(world);
        projectiles?.reset(world);
        specialEffects.reset(world);
        actorOpacity.reset(world);
        shieldFlash?.reset(world);
        damageMask?.advance(world);
        departures?.advance(world);
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
