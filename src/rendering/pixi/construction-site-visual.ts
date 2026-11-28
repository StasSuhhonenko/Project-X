/** Pending site registration and view-owned sample playback. */
import { Container, Matrix, Sprite, type Texture } from 'pixi.js';
import type { ConstructionSiteVisual } from '../../content/schemas/game-module';
import type { NpcShipEntity, StationEntity } from '../../simulation/model/world-state';
import {
  interpolateAffineMatrix,
  prepareConstructionTimeline,
  type AffineMatrixBuffer,
} from '../shared/construction-timeline';
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
      // SVG raster density may differ from the authored logical dimensions.
      return [
        image,
        { texture, xScale: nativeSize.width / texture.orig.width, yScale: nativeSize.height / texture.orig.height },
      ] as const;
    })
  );
  const timeline = prepareConstructionTimeline(animation);
  const layers = timeline.layers.map(({ frames, slotCount }) => {
    const sprites = Array.from({ length: slotCount }, () => {
      const sprite = new Sprite();
      container.addChild(sprite);
      return sprite;
    });
    return { frames, sprites };
  });
  const cycleLength = timeline.blendingFrames.length;
  const matrix = new Matrix();
  // The sprite consumes each sampled transform immediately, so slots share scratch storage.
  const blendedMatrix: AffineMatrixBuffer = [0, 0, 0, 0, 0, 0];
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
      const elapsedFrames = ((nowMs - startedAt) * animation.frameRate) / 1000;
      const wholeFrames = Math.floor(elapsedFrames);
      const index = wholeFrames % cycleLength;
      const sameFrame = index === lastFrame;
      if (sameFrame && !timeline.blendingFrames[index]) return;
      lastFrame = index;
      const fraction = elapsedFrames - wholeFrames;
      layers.forEach(({ frames, sprites }) => {
        const sample = frames[index]!;
        if (sameFrame && !sample.blends) return;
        sprites.forEach((sprite, spriteIndex) => {
          const slot = sample.slots[spriteIndex];
          if (sameFrame && !slot?.blend) return;
          sprite.visible = slot !== undefined;
          if (!slot) return;
          const { placement, blend } = slot;
          const { texture, xScale, yScale } = artwork.get(placement.image)!;
          if (!sameFrame) sprite.texture = texture;
          const [a, b, c, d, tx, ty] = blend
            ? interpolateAffineMatrix(blend, fraction, blendedMatrix)
            : placement.matrix;
          sprite.setFromMatrix(matrix.set(a * xScale, b * xScale, c * yScale, d * yScale, tx, ty));
        });
      });
    },
  };
}
