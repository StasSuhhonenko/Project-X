/** The selected Symbol10 hull child shared by every UI pose that paints the
 * live player clip (UI-24 death, UI-21 departure). One prepared registration
 * per player-capable hull is projected from the flight sprite manifest by
 * `prepare-player-hull-art.cjs`, so these screens cover exactly the hulls that
 * can fly. Coordinates are logical source pixels; matrices are SVG order
 * [a b c d tx ty]. */
import { z } from 'zod';
import { hasReviewedPlayerActorScale, PlayerActorScaleSchema } from './player-actor-scale';
import raw from './player-hull-art.json';
import { runtimeAssetUrl } from './runtime-assets';

const finite = z.number().finite();
export const SourceMatrixSchema = z.tuple([finite, finite, finite, finite, finite, finite]).readonly();
export type SourceMatrix = z.infer<typeof SourceMatrixSchema>;
const PlayerHullSchema = z
  .object({
    definitionId: z.number().int().positive(),
    /** Staging source key; `runtimeAssetUrl` resolves it to the published sprite. */
    image: z.string().regex(/^assets\/[A-Za-z0-9_-]+\.png$/),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    /** Raw Symbol10 child transform inside the Symbol2 player instance. */
    matrix: SourceMatrixSchema,
    playerScale: PlayerActorScaleSchema.optional(),
  })
  .strict()
  .readonly();
export type PlayerHull = z.infer<typeof PlayerHullSchema>;
export const PlayerHullArtSchema = z
  .object({ hulls: z.array(PlayerHullSchema).min(1).readonly() })
  .strict()
  .superRefine(({ hulls }, context) => {
    if (new Set(hulls.map(h => h.definitionId)).size !== hulls.length)
      context.addIssue({ code: 'custom', message: 'Duplicate player hull registration' });
    if (!hulls.every(hasReviewedPlayerActorScale))
      context.addIssue({ code: 'custom', message: 'Player actor outer scale ownership changed' });
  })
  .readonly();
export const playerHullArt = PlayerHullArtSchema.parse(raw);

/** Undefined means the hull has no flight registration; callers fail closed. */
export const playerHull = (definitionId: number): PlayerHull | undefined =>
  playerHullArt.hulls.find(hull => hull.definitionId === definitionId);
export const playerHullAsset = (hull: PlayerHull) => runtimeAssetUrl(hull.image);
export const sourceMatrix = (matrix: SourceMatrix) => `matrix(${matrix.join(' ')})`;

/** Paints the hull at its authored child transform under the pose's recorded
 * Symbol2 parent matrix. Callers keep source paint order around it. */
export function PlayerHullImage({ hull, parent }: { readonly hull: PlayerHull; readonly parent: SourceMatrix }) {
  return (
    <g transform={sourceMatrix(parent)} data-player-hull={hull.definitionId}>
      <image
        href={playerHullAsset(hull)}
        width={hull.width}
        height={hull.height}
        transform={sourceMatrix(hull.matrix)}
      />
    </g>
  );
}
