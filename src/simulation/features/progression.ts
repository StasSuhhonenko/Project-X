/** Shared policy boundary. Hosts publish only their completed transition. */
import type { GameRules } from '../contracts/game-rules';
import { ProgressionEventSchema, ProgressionResultSchema, type ProgressionEvent } from '../contracts/progression-rules';
import {
  applyProgressionDelta,
  validateProgressionState,
  type ProgressionDefinition,
} from '../model/progression-state';
import { freezeWorld, type WorldState } from '../model/world-schema';

type HostEvent<Event = ProgressionEvent> = Event extends ProgressionEvent
  ? Omit<Event, 'progression' | 'randomState'>
  : never;
/** Null/absent policy retains the exact input reference. Invalid policy output
 * throws before publication, aborting the enclosing host action atomically. */
export function resolveProgression(
  world: WorldState,
  rules: GameRules,
  content: ProgressionDefinition | undefined,
  host: HostEvent
): WorldState {
  if (!content || !world.progression || !rules.resolveProgression) return world;
  validateProgressionState(world.progression, content);
  const event = ProgressionEventSchema.parse({
    ...host,
    progression: world.progression,
    randomState: world.progression.randomState,
  });
  const result = rules.resolveProgression(event);
  if (result === null) return world;
  const parsed = ProgressionResultSchema.parse(result);
  const applied = applyProgressionDelta(world, parsed.delta, content);
  if (parsed.randomState === applied.progression!.randomState) return applied;
  // The delta operation validated the world; the result schema validated this
  // isolated stream replacement. Avoid parsing the same world a second time.
  return freezeWorld({ ...applied, progression: { ...applied.progression!, randomState: parsed.randomState } });
}
