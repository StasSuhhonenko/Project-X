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
 * `createalliedship()` sets mydist8 (Page1:25841:483-488) for every created
 * fleet ship: visit presence (:383), launch (Symbol2:6202:227) and purchase
 * (Symbol3:83473:49). A captured ship keeps its blip until it is re-created.
 * The mydist7 write sits in the brain's player-target branch, which a
 * government-16 (player fleet) ship takes to the "Captain, what are you
 * doing?!?!?" arm instead (Symbol12:11050:76-81). Fleet ships, created or
 * captured, therefore never turn red, although Escort and other peaceful fleet
 * navigation does target the player. For any other actor the red check runs
 * first. Wormhole frame10 is recovered but has no C16 producer yet. */
export function minimapMarker(entity: SpatialOverview[number], x: number, y: number) {
  const point = minimapPoint(x, y);
  if (entity.kind !== 'planet') {
    if (point.x < 494 || point.y < 372 || point.x > 590 || point.y > 440) return null;
    if (entity.targetsPlayer && !entity.fleet) return { ...point, frame: 7 };
    if (entity.fleet === 'created') return { ...point, frame: 8 };
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
