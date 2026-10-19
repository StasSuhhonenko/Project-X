/** Module-authored backdrop particles; all distances are logical screen pixels. */
import { z } from 'zod';
import { UInt32Schema } from '../../random/seeded-random';

export const StarDefinitionSchema = z.object({
  position: z.object({ x: z.number().finite(), y: z.number().finite() }).strict().readonly(),
  radius: z.number().finite().positive().max(16),
  parallax: z.number().finite().nonnegative().max(10),
  initialScale: z.number().finite().positive().max(100),
  /** Negative forward speed below which vertical scale changes, evaluated per tick. */
  stretch: z.object({
    speedThreshold: z.number().finite().negative(),
    scaleY: z.number().finite().positive().max(100),
  }).strict().readonly().nullable(),
}).strict().readonly();

export const StarFieldDefinitionSchema = z.object({
  /** Random edge respawn discards overshoot; wrap preserves it without randomness. */
  boundary: z.enum(['random-edge', 'wrap']),
  seed: UInt32Schema,
  color: z.number().int().min(0).max(0xffffff),
  alpha: z.number().finite().min(0).max(1),
  stars: z.array(StarDefinitionSchema).max(1000).readonly(),
}).strict().readonly();

export type StarDefinition = z.infer<typeof StarDefinitionSchema>;
export type StarFieldDefinition = z.infer<typeof StarFieldDefinitionSchema>;
