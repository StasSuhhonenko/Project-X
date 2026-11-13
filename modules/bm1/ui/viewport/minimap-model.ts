/** Source marker frames and projection. Screen coordinates are compressed by
 * 100 around the authored center, independently of simulation world units. */
import { z } from 'zod';
import type { SpatialOverview } from '@engine/ui/spatial-overview-view';
import raw from '../minimap-data.json';

const ink = z.union([z.literal('none'), z.string().regex(/^#[0-9a-f]{6}$/)]);
export const MinimapContentSchema = z
  .object({
    frames: z
      .array(
        z
          .object({
            frame: z.number().int().min(1).max(11),
            path: z.string().regex(/^[MLQZ0-9e., +\-]*$/),
            fill: ink,
            stroke: ink,
            strokeWidth: z.number().finite().nonnegative(),
          })
          .strict()
          .readonly()
      )
      .length(11)
      .readonly(),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.frames.some((frame, index) => frame.frame !== index + 1))
      context.addIssue({ code: 'custom', message: 'Marker frames must retain source order 1..11.' });
  })
  .readonly();
export const minimapContent = MinimapContentSchema.parse(raw);

export function minimapPoint(x: number, y: number) {
  return Object.freeze({ x: 544 + (x - 544) / 100, y: 403 + (y - 403) / 100 });
}

/** The source latches frame7 forever. Adaptation: current navigation intent
 * chooses red live, returning to the ordinary frame when that intent changes.
 * Stations own a blip too (Page1:25841:321) and run the same brain, whose
 * player-targeting branches write mydist7 (Symbol12:11050:28,81), so a station
 * targeting the player is also drawn as the red frame7 dot.
 * Allied frame8 and wormhole frame10 are recovered but have no C11/C16 producer. */
export function minimapMarker(entity: SpatialOverview[number], x: number, y: number) {
  const point = minimapPoint(x, y);
  if (entity.kind !== 'planet') {
    if (point.x < 494 || point.y < 372 || point.x > 590 || point.y > 440) return null;
    if (entity.targetsPlayer) return { ...point, frame: 7 };
    return { ...point, frame: entity.kind === 'station' ? 9 : 6 };
  }
  let frame = 1;
  // These independent checks intentionally preserve source precedence at corners.
  if (point.x < 494) frame = 5;
  if (point.y < 372) frame = 2;
  if (point.x > 590) frame = 3;
  if (point.y > 440) frame = 4;
  return { x: Math.max(494, Math.min(590, point.x)), y: Math.max(372, Math.min(440, point.y)), frame };
}

/** The same source frame that falls below10 resets to100: zero is not drawn.
 * Frame0 is selection entry before the first enterFrame callback. */
export function minimapAlpha(selected: boolean, cloaked: boolean, elapsedFrames: number) {
  if (cloaked) return 0;
  if (!selected) return 1;
  return (5 - (elapsedFrames % 5)) / 5;
}
