import { z } from 'zod';

const FiniteNumber = z.number().finite();
const AssetPath = z.string().regex(/^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:gif|png|jpg|webp|svg)$/);
const NativeSizeSchema = z
  .object({ width: z.number().int().positive(), height: z.number().int().positive() })
  .strict()
  .readonly();
/** Bitmap registration may lie outside a projectile image. Preserve authored
 * fractions rather than silently recentering narrow streaks. */
export const ProjectileImageSchema = z
  .object({
    image: AssetPath,
    nativeSize: NativeSizeSchema,
    logicalSize: z.object({ width: FiniteNumber.positive(), height: FiniteNumber.positive() }).strict().readonly(),
    pivot: z.object({ x: FiniteNumber, y: FiniteNumber }).strict().readonly(),
  })
  .strict()
  .readonly();

/** Each bitmap keeps its own complete affine transform in logical pixels. */
export const ProjectileBitmapLayerSchema = ProjectileImageSchema.unwrap()
  .extend({
    bitmapTransform: z
      .tuple([FiniteNumber, FiniteNumber, FiniteNumber, FiniteNumber, FiniteNumber, FiniteNumber])
      .readonly(),
  })
  .strict()
  .readonly();
