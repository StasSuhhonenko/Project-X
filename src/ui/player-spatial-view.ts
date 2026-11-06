/** Logical viewport geometry of the player, independent of DOM scale and DPR. */
import { z } from 'zod';

export const PlayerSpatialViewSchema = z
  .object({
    /** Clockwise heading, zero up; committed simulation heading. */
    headingDegrees: z.number().finite(),
    /** Sprite registration point in logical viewport pixels. */
    x: z.number().finite(),
    y: z.number().finite(),
    /** Unrotated displayed dimensions, already divided by zoom. */
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
    /** Axis-aligned dimensions after rotation, in logical viewport pixels. */
    boundsWidth: z.number().finite().positive(),
    boundsHeight: z.number().finite().positive(),
    zoom: z.number().finite().positive(),
  })
  .strict()
  .readonly();
export type PlayerSpatialView = z.infer<typeof PlayerSpatialViewSchema>;
