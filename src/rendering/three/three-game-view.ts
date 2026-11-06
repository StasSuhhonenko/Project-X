/** One disposable Three.js view. Rendering is driven exclusively by host frame
 * callbacks; picking uses the camera/meshes from the last completed draw. */
import {
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
  type Object3D,
} from 'three';
import type { GameModuleDefinition } from '../../content/schemas/game-module';
import { selectPlayerEntity } from '../../simulation/model/world-state';
import type { SpatialAttachment, SpatialView } from '../contracts/spatial-presentation';
import { createActorOpacity } from '../shared/actor-opacity';
import { createPresentationTiming } from '../shared/presentation-timing';
import { createTransformHistory } from '../shared/transform-history';
import { createThreeActor } from './actors';
import { createThreeCamera, modelYaw } from './camera';
import type { ThreeSpatialConfiguration } from './configuration';
import { createThreeEffects } from './effects';

export function createThreeGameView(
  { host, source, intents }: SpatialAttachment,
  game: GameModuleDefinition,
  config: ThreeSpatialConfiguration,
  model: Object3D
): SpatialView {
  const initial = source.getState();
  if (!initial.world) throw new Error('Cannot attach a spatial scene without a world.');
  const initialPlayer = selectPlayerEntity(initial.world);
  const scene = new Scene();
  scene.background = new Color(config.background);
  scene.add(new HemisphereLight(0xc7e9ff, 0x172036, 2));
  const light = new DirectionalLight(0xffffff, 3);
  light.position.set(-200, 400, 100);
  scene.add(light);
  const camera = createThreeCamera(config.camera, game.viewport);
  const history = createTransformHistory(initial.world);
  const timing = createPresentationTiming(game.framesPerSecond);
  const opacity = createActorOpacity(initial.world, config.cloak);
  const actors = new Map<string, ReturnType<typeof createThreeActor>>();
  const effectLayer = new Group();
  scene.add(effectLayer);
  const effects = createThreeEffects(initial.world, game, config, effectLayer);
  const raycaster = new Raycaster();
  let renderer: WebGLRenderer | undefined;
  let unsubscribe: (() => void) | undefined;
  let observer: ResizeObserver | undefined;
  let disposed = false;
  let resolutionDirty = true;
  let previousDpr = 0;
  const ownsWorld = () => {
    const state = source.getState();
    if (!state.world || state.sessionRevision !== initial.sessionRevision) return false;
    const player = selectPlayerEntity(state.world);
    return (
      player.definitionId === initialPlayer.definitionId && player.location.systemId === initialPlayer.location.systemId
    );
  };
  const pointer = (event: PointerEvent) => {
    if (event.button !== 0 || !ownsWorld() || !renderer || disposed) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    const y = 1 - ((event.clientY - bounds.top) / bounds.height) * 2;
    if (![x, y].every(Number.isFinite)) return;
    raycaster.setFromCamera(new Vector2(x, y), camera.camera);
    const world = source.getState().world!;
    const roots = [...actors.values()]
      .filter(item => item.root.userData.entityId !== world.playerEntityId)
      .map(item => item.root);
    const hits = raycaster.intersectObjects(roots, true);
    const contact =
      hits
        .map(hit => {
          let node: Object3D | null = hit.object;
          while (node && typeof node.userData.entityId !== 'string') node = node.parent;
          const entity = node && world.entities.find(item => item.id === node!.userData.entityId);
          if (!entity || entity.kind === 'player-ship') return null;
          return { id: entity.id, kind: entity.kind, selectedBefore: world.selectedTargetEntityId === entity.id };
        })
        .find(item => item !== null) ?? null;
    intents.selectTarget(contact?.kind === 'planet' ? null : (contact?.id ?? null));
    intents.activate(contact);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    let firstFailure: unknown;
    const attempt = (cleanup: () => void) => {
      try {
        cleanup();
      } catch (error) {
        firstFailure ??= error;
      }
    };
    if (unsubscribe) attempt(unsubscribe);
    if (observer) attempt(() => observer!.disconnect());
    if (renderer) {
      const owned = renderer;
      attempt(() => owned.domElement.removeEventListener('pointerdown', pointer));
      attempt(() => owned.domElement.remove());
    }
    actors.forEach(item => attempt(item.dispose));
    actors.clear();
    attempt(effects.dispose);
    if (renderer) {
      const owned = renderer;
      attempt(() => owned.dispose());
      attempt(() => owned.forceContextLoss());
    }
    scene.clear();
    if (firstFailure) throw firstFailure;
  };
  const view: SpatialView = {
    render: (alpha, frame) => {
      if (disposed || !ownsWorld() || !renderer) return;
      const world = source.getState().world!;
      const sample = timing.sample(alpha, frame);
      if (sample.rebaseHistory) history.reset(world);
      const fraction = Number.isFinite(sample.alpha) ? Math.min(1, Math.max(0, sample.alpha)) : 1;
      const player = history.sample(world.playerEntityId, fraction)!;
      camera.update(player, world.cameraZoom);
      const dpr = window.devicePixelRatio || 1;
      if (resolutionDirty || dpr !== previousDpr) {
        const bounds = host.getBoundingClientRect();
        const scale = Math.max(1, Math.min(bounds.width / game.viewport.width, bounds.height / game.viewport.height));
        renderer.setPixelRatio(dpr * scale);
        renderer.setSize(game.viewport.width, game.viewport.height, false);
        resolutionDirty = false;
        previousDpr = dpr;
      }
      const live = new Set(world.entities.map(entity => entity.id));
      actors.forEach((item, id) => {
        if (live.has(id)) return;
        scene.remove(item.root);
        item.dispose();
        actors.delete(id);
      });
      world.entities.forEach(entity => {
        let actor = actors.get(entity.id);
        if (!actor) {
          actor = createThreeActor(entity, config, model);
          actors.set(entity.id, actor);
          scene.add(actor.root);
        }
        const transform = history.sample(entity.id, fraction)!;
        actor.root.position.set(transform.x, entity.kind === 'planet' ? -config.planet.radius * 0.45 : 5, transform.y);
        actor.root.rotation.y = modelYaw(transform.rotationDegrees);
        const value = opacity.sample(entity.id, fraction);
        actor.root.visible = value > 0;
        actor.materials.forEach(material => {
          material.opacity = value;
          material.emissive.setHex(entity.id === world.selectedTargetEntityId ? 0x3e3100 : 0);
        });
      });
      effects.render(fraction, history);
      renderer.render(scene, camera.camera);
      timing.didDraw(fraction);
    },
    reset: () => {
      const world = source.getState().world;
      if (!world || !ownsWorld()) return;
      history.reset(world);
      timing.reset();
      opacity.reset(world);
      effects.reset(world);
    },
    dispose,
  };
  try {
    renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
    renderer.domElement.dataset.sceneRenderer = 'three';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);
    renderer.domElement.addEventListener('pointerdown', pointer);
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        resolutionDirty = true;
      });
      observer.observe(host);
    }
    unsubscribe = source.subscribe(state => {
      if (!state.world || !ownsWorld()) return;
      history.advance(state.world);
      opacity.advance(state.world);
      effects.advance(state.world);
    });
    view.render(1);
    return view;
  } catch (error) {
    try {
      dispose();
    } catch {
      /* Preserve the initiating attachment failure. */
    }
    throw error;
  }
}
