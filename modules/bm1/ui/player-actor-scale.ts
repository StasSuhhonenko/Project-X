/** Source loadplayer may resize the whole player MovieClip, independently of
 * its selected bitmap and the communication preview. Actor artwork retains its
 * raw child transform; apply the recovered outer factor once to the entire pose
 * (including effects and childless travel poses), then apply world zoom. */
import { z } from 'zod';
export const PlayerActorScaleSchema = z.number().finite().positive();
export const playerActorScale = (playerScale: number | undefined, zoom: number) => (playerScale ?? 1) / zoom;

/** The reviewed source has one exceptional outer-player assignment. Keeping
 * this ownership check shared prevents travel and death evidence from drifting. */
const PlayerActorRegistrationSchema = z.object({ definitionId: z.number().int(), playerScale: PlayerActorScaleSchema.optional() }).readonly();
export const hasReviewedPlayerActorScale = (actor: z.infer<typeof PlayerActorRegistrationSchema>) =>
  actor.definitionId === 44 ? actor.playerScale === 0.5 : actor.playerScale === undefined;
