/** Atomic, draw-free application of optional module-owned text effects. */
import type { GameModule } from '../../content/game-module';
import { TextCommandIntentSchema, TextCommandResultSchema, type TextCommandIntent } from '../contracts/text-command';
import { applyStandingUpdates, hasExactStandingScope } from '../model/lifecycle-state';
import { applyProgressionAssignment } from '../model/progression-state';
import { parseWorldState, selectPlayerEntity, type WorldState } from '../model/world-state';

/** Refusals retain the input reference. Repair permits submission; terminal
 * worlds do not. changed reports actual value differences, not recognition.
 * No tick, feedback, saved field or random stream is created by this operation. */
export function submitTextCommand(
  world: WorldState,
  game: GameModule,
  input: TextCommandIntent
): { world: WorldState; changed: boolean } {
  const unchanged = { world, changed: false };
  const intent = TextCommandIntentSchema.safeParse(input);
  if (!intent.success || world.status !== 'active' || !game.rules.resolveTextCommand) return unchanged;
  const player = selectPlayerEntity(world);
  const standingSystemIds = game.definition.lifecycle?.standingSystemIds ?? Object.freeze([]);
  const parsed = TextCommandResultSchema.safeParse(
    game.rules.resolveTextCommand(
      Object.freeze({
        text: intent.data.text,
        resources: player.inventory.resources,
        systemId: player.location.systemId,
        standingSystemIds,
      })
    )
  );
  if (!parsed.success) return unchanged;
  const result = parsed.data;
  if (Object.keys(result.resources).some(id => !game.definition.resources.some(resource => resource.id === id)))
    return unchanged;
  if (!hasExactStandingScope(world.lifecycle.systemStanding, standingSystemIds)) return unchanged;
  try {
    // The standing owner rejects duplicate/foreign scopes. The progression owner
    // rejects foreign skills and validates exact content scope. Neither mutates.
    const standing = applyStandingUpdates(world.lifecycle.systemStanding, result.standing);
    const resourcesChanged = Object.entries(result.resources).some(
      ([id, value]) => player.inventory.resources[id] !== value
    );
    const experienceChanged = Object.entries(result.experience).some(
      ([id, value]) => world.progression?.experience[id] !== value
    );
    const standingChanged = standing.some(
      (entry, index) => entry.value !== world.lifecycle.systemStanding[index]!.value
    );
    if (!resourcesChanged && !experienceChanged && !standingChanged) return unchanged;
    const candidate = {
      ...world,
      lifecycle: { ...world.lifecycle, systemStanding: standing },
      entities: world.entities.map(entity =>
        entity.id !== player.id
          ? entity
          : {
              ...player,
              inventory: { ...player.inventory, resources: { ...player.inventory.resources, ...result.resources } },
            }
      ),
    };
    // Assignment performs the single final world parse when it has writes.
    // Without experience writes, this feature owns that one parse instead.
    const next =
      Object.keys(result.experience).length > 0
        ? applyProgressionAssignment(candidate, result.experience, game.definition.progression)
        : parseWorldState(candidate);
    return { world: next, changed: true };
  } catch {
    // A malformed policy result refuses all writes, including otherwise valid ones.
    return unchanged;
  }
}
