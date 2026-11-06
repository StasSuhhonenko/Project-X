/** Maintained UI-24 ink boundary. Coordinates and lengths are source-stage
 * pixels. Each nested object/array is frozen at validation; callers cannot
 * alter the selected source frame or replace a staged asset reference. */
import { z } from 'zod';
import { hasReviewedPlayerActorScale, PlayerActorScaleSchema } from '../player-actor-scale';
import { runtimeAssetUrl } from '../runtime-assets';
import raw from '../terminal-data.json';

const finite = z.number().finite();
const PoseSchema = z
  .object({ frame: z.number().int(), file: z.string().regex(/^terminal-[a-z0-9-]+\.svg$/) })
  .strict()
  .readonly();
export const TerminalContentSchema = z
  .object({
    death: z
      .array(
        z
          .object({
            definitionId: z.number().int(),
            playerScale: PlayerActorScaleSchema.optional(),
            poses: z.array(PoseSchema).length(6).readonly(),
          })
          .strict()
          .readonly()
      )
      .length(10)
      .readonly(),
    page: z.array(PoseSchema).length(7).readonly(),
    control: z
      .object({
        file: z.literal('terminal-control.svg'),
        scriptOffset: z.literal(1694),
        bounds: z.object({ left: finite, right: finite, top: finite, bottom: finite }).strict().readonly(),
      })
      .strict()
      .readonly(),
  })
  .strict()
  .superRefine((content, context) => {
    const fail = (message: string) => context.addIssue({ code: 'custom', message });
    if (!content.death.every(hasReviewedPlayerActorScale)) fail('Player actor outer scale ownership changed');
    if (
      content.death.map(s => s.definitionId).join(',') !== '6,7,16,18,25,29,30,31,39,44' ||
      content.death.some(
        s =>
          s.poses.map(p => p.frame).join(',') !== '21,22,23,24,25,26' ||
          s.poses.some(p => p.file !== `terminal-death-${s.definitionId}-${p.frame}.svg`)
      )
    )
      fail('Death selector/source pose ownership changed');
    if (
      content.page.map(p => p.frame).join(',') !== '1,13,25,26,28,40,41' ||
      content.page.some(p => p.file !== `terminal-page-${p.frame}.svg`)
    )
      fail('Terminal source keyframe ownership changed');
    const b = content.control.bounds;
    if (
      b.left !== 257.9477203369141 ||
      b.right !== 323.65227966308595 ||
      b.top !== 172.06396255493163 ||
      b.bottom !== 237.63603744506835
    )
      fail('Reincarnate source bounds changed');
  })
  .readonly();
export const terminalContent = TerminalContentSchema.parse(raw);
export const terminalAsset = (file: string) => runtimeAssetUrl(`assets/terminal/${file}`);
export const terminalAssets = Object.freeze([
  terminalContent.control.file,
  ...terminalContent.page.map(p => p.file),
  ...terminalContent.death.flatMap(s => s.poses.map(p => p.file)),
]);
/** Six explosion poses each hold one source interval. Frame27 removes the
 * entire actor before dead() enters Page5; it never paints the fixture's
 * incidental child selector at frame27 as an extra surviving player. */
export const DEATH_DURATION_MS = (6 * 1000) / 13;
export function terminalPose(elapsedMs: number) {
  const interval = Math.floor((Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0) * 13) / 1000);
  if (interval < 6) return { kind: 'death' as const, frame: interval + 21, pose: interval + 21 };
  const frame = Math.min(26, interval - 6 + 1);
  const pose = frame >= 26 ? 26 : frame >= 25 ? 25 : frame >= 13 ? 13 : 1;
  return { kind: 'page' as const, frame, pose };
}
/** This is the bounded held-action interpretation, not native Flash dispatch
 * parity: release enters28, held2051 returns26; only direct frame41 means exit.
 * Keep the latter contract explicit without inventing a runtime caller. */
export function terminalSourceAction(frame: number): 'hold' | 'return26' | 'entry' {
  if (frame === 41) return 'entry';
  if (frame >= 27 && frame <= 40) return 'return26';
  return 'hold';
}
