/** Trusted module presentation objects in logical viewport pixels. They have
 * no runtime entity identity, interaction, world ownership or save lifetime. */
import { z } from 'zod';
const finite = z.number().finite();
export const ParallaxLayerSchema = z.object({
  image: z.string().min(1),
  x: finite, y: finite, width:finite.positive(), height:finite.positive(),
  parallax:finite.nonnegative().max(10),
}).strict().readonly();
export type ParallaxLayer = z.infer<typeof ParallaxLayerSchema>;
