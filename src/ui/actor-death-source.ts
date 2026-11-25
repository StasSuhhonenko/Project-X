/** Narrow publication source for transient death ink. Unlike React props, this
 * subscription observes every completed tick even when React batches renders. */
import { z } from 'zod';
import { ActorDeathEventsSchema, type ActorDeathEvent } from '../simulation/model/actor-death-event';
import type { WorldState } from '../simulation/model/world-state';

export const ActorDeathPublicationSchema = z
  .object({
    tick: z.number().int().nonnegative(),
    sessionRevision: z.number().int().nonnegative(),
    events: ActorDeathEventsSchema,
  })
  .strict()
  .readonly();
export type ActorDeathPublication = z.infer<typeof ActorDeathPublicationSchema>;
export interface ActorDeathSource {
  getSnapshot(): ActorDeathPublication;
  subscribe(listener: (state: ActorDeathPublication) => void): () => void;
}

/** Adapt the host store without exposing entities, commands or mutable state to
 * a module's death presentation. Existing frozen event records can be shared. */
export function createActorDeathSource(source: {
  getState(): { readonly world: WorldState | null; readonly sessionRevision: number };
  subscribe(
    listener: (state: { readonly world: WorldState | null; readonly sessionRevision: number }) => void
  ): () => void;
}): ActorDeathSource {
  const project = (state: ReturnType<typeof source.getState>): ActorDeathPublication =>
    Object.freeze({
      tick: state.world?.tick ?? 0,
      sessionRevision: state.sessionRevision,
      events: state.world?.actorDeathEvents ?? Object.freeze([]),
    });
  return {
    getSnapshot: () => project(source.getState()),
    subscribe: receive => source.subscribe(state => receive(project(state))),
  };
}

/** Observe each death once per session. Scene mounting/restoring seeds a fresh
 * tick baseline, so persisted events can never be replayed.
 *
 * Deaths arrive two ways. A tick step clears last tick's events, so every event
 * in a newer tick is new. A command committed between ticks (boarding
 * self-destruction via Transport) appends to the current tick's events without
 * advancing the tick; those are new when their actor was absent from the
 * previous publication (actor ids are unique within one tick's events). Before
 * 2026-11-25 such same-tick deaths were ignored and the next step cleared them,
 * so a self-destructing boarded ship vanished without its explosion. */
export function observeActorDeaths(source: ActorDeathSource, receive: (events: readonly ActorDeathEvent[]) => void) {
  let baseline = source.getSnapshot();
  return source.subscribe(state => {
    const before = baseline;
    baseline = state;
    if (state.sessionRevision !== before.sessionRevision || state.tick < before.tick) return;
    const known = state.tick === before.tick ? new Set(before.events.map(event => event.actorEntityId)) : null;
    const fresh = known ? state.events.filter(event => !known.has(event.actorEntityId)) : state.events;
    if (fresh.length) receive(fresh);
  });
}
