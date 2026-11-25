/** Pending site registration and view-owned sample playback. */
import { Container, Matrix, Sprite, type Texture } from 'pixi.js';
import type { ConstructionSiteVisual } from '../../content/schemas/game-module';
import type { NpcShipEntity, StationEntity } from '../../simulation/model/world-state';
import type { PixiSceneDefinition } from './configuration';

type ActorVisual = PixiSceneDefinition['visuals']['entities'][number] & { readonly rotationDegrees?: number | undefined };

export function actorVisual(
  definition: PixiSceneDefinition,
  actor: StationEntity | NpcShipEntity
): ActorVisual | undefined {
  if (actor.kind === 'station' && actor.construction === 'pending') {
    const visual = definition.visuals.constructionSite;
    if (!visual) throw Error('Pending construction site visual is unavailable.');
    const { image, nativeSize, scaffoldOffset, rotationDegrees } = visual;
    return {
      image,
      nativeSize,
      rotationDegrees,
      entityDefinitionId: actor.definitionId,
      pivot: scaffoldOffset
        ? { x: -scaffoldOffset.x / nativeSize.width, y: -scaffoldOffset.y / nativeSize.height, status: 'verified' }
        : { x: 0.5, y: 0.5, status: 'provisional' },
    };
  }
  return definition.visuals.entities.find(candidate => candidate.entityDefinitionId === actor.definitionId);
}

/** A site starts at frame zero when first visible in a view, including after
 * restore. All layer samples advance together on the monotonic display clock.
 * Sampling is independent of the simulation clock, world state and RNG. */
export function createConstructionSiteAnimation(
  animation: NonNullable<ConstructionSiteVisual['animation']>,
  textures: ReadonlyMap<string, Texture>
) {
  const container = new Container();
  const artwork = new Map(
    animation.artwork.map(({ image, nativeSize }) => {
      const texture = textures.get(image);
      if (!texture) throw new Error('Construction-site animation artwork was not preloaded.');
      return [image, { texture, nativeSize }] as const;
    })
  );
  const layers = animation.layers.map(layer => {
    const frames = layer.keyframes.flatMap(frame =>
      frame.tweenKind === 'none' ? Array.from({ length: frame.duration }, () => frame.samples[0]!) : frame.samples
    );
    const sprites = Array.from({ length: Math.max(...frames.map(frame => frame.length)) }, () => {
      const sprite = new Sprite();
      container.addChild(sprite);
      return sprite;
    });
    return { frames, sprites };
  });
  const cycleLength = layers[0]!.frames.length;
  const matrix = new Matrix();
  let startedAt: number | undefined;
  let lastFrame = -1;

  return {
    container,
    render(nowMs: number, scaffold: Sprite, zoom: number) {
      container.visible = scaffold.visible;
      if (!container.visible) return;
      container.position.copyFrom(scaffold.position);
      container.rotation = scaffold.rotation;
      container.scale.set(1 / zoom);
      container.alpha = scaffold.alpha;
      startedAt ??= nowMs;
      const index = Math.floor(((nowMs - startedAt) * animation.frameRate) / 1000) % cycleLength;
      if (index === lastFrame) return;
      lastFrame = index;
      layers.forEach(({ frames, sprites }) => {
        const sample = frames[index]!;
        sprites.forEach((sprite, spriteIndex) => {
          const placement = sample[spriteIndex];
          sprite.visible = placement !== undefined;
          if (!placement) return;
          const { texture, nativeSize } = artwork.get(placement.image)!;
          sprite.texture = texture;
          const [a, b, c, d, tx, ty] = placement.matrix;
          // SVG raster density may differ from the authored logical dimensions.
          const xScale = nativeSize.width / texture.orig.width;
          const yScale = nativeSize.height / texture.orig.height;
          sprite.setFromMatrix(matrix.set(a * xScale, b * xScale, c * yScale, d * yScale, tx, ty));
        });
      });
    },
  };
}
