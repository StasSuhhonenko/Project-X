/** Transient presentation facts, emitted only by death settlement. No damage or
 * outcome consumer may process these events. Runtime IDs are never reused. */
import { z } from 'zod';
import { PositionSchema, PositiveDefinitionIdSchema, RuntimeEntityIdSchema } from './entity-components';
import type { NpcShipEntity, StationEntity } from './world-schema';

export const ActorDeathEventSchema = z
  .object({
    actorEntityId: RuntimeEntityIdSchema,
    kind: z.enum(['npc-ship', 'station']),
    definitionId: PositiveDefinitionIdSchema,
    position: PositionSchema,
    tick: z.number().int().nonnegative(),
  })
  .strict()
  .readonly();
export const ActorDeathEventsSchema = z.array(ActorDeathEventSchema).max(100000).readonly();
export type ActorDeathEvent = z.infer<typeof ActorDeathEventSchema>;

/** Capture before removal. Both the runtime hit owner and the deprecated
 * outcome-free destruction adapter use this single event constructor. */
export function captureActorDeath(actor: NpcShipEntity | StationEntity, tick: number): ActorDeathEvent {
  return ActorDeathEventSchema.parse({
    actorEntityId: actor.id,
    kind: actor.kind,
    definitionId: actor.definitionId,
    position: actor.location.position,
    tick,
  });
}
