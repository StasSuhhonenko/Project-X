/** One ordered NPC navigation pass shared by ordinary and equipped combat.
 * Every NPC steers with its own saved actor stream (`npc.randomState`), so
 * adding or removing one actor never shifts another actor's draws, and
 * navigation never consumes the world stream (C10a). */
import type { GameRules } from '../contracts/game-rules';
import { combinedDurabilityPercent, freezeNpcTargetState, NpcTickResultSchema } from '../model/npc-state';
import { selectNpcMovementState, selectWorldEntity, type NpcWorldUpdate, type WorldState } from '../model/world-state';
import type { WorldTickDefinitions } from './advance-world';

/** Saved source slots establish order without compacting holes. Any unslotted
 * NPC follows in entity order. IDs are unique in a validated world. */
export function orderedNpcIds(world: WorldState): readonly string[] {
  const ids = world.entities.filter(entity => entity.kind === 'npc-ship').map(entity => entity.id);
  const npcIds = new Set(ids);
  const slotted = world.specialActorSlots.filter((id): id is string => id !== null && npcIds.has(id));
  const seen = new Set(slotted);
  return [...slotted, ...ids.filter(id => !seen.has(id))];
}

/** Returns exactly one update per NPC. Actors without a live target, with
 * disabled engines or outside `movableIds` keep their movement and stream. */
export function advanceNpcNavigation(
  world: WorldState,
  definitions: WorldTickDefinitions,
  rules: GameRules,
  cameraZoom: number,
  movableIds?: ReadonlySet<string>
): readonly NpcWorldUpdate[] {
  return orderedNpcIds(world).map(id => {
    const npc = world.entities.find(entity => entity.id === id)!;
    if (npc.kind !== 'npc-ship') throw new Error('NPC order contains a non-ship.');
    const vessel = definitions.getShipDefinition(npc.definitionId);
    if (!vessel) throw new Error(`NPC ${npc.id} has an invalid vessel reference.`);
    const target =
      npc.navigation.targetEntityId === null ? null : selectWorldEntity(world, npc.navigation.targetEntityId);
    if (!target || npc.specialStatus.engineDisabledFrames > 0 || (movableIds && !movableIds.has(npc.id)))
      return { id: npc.id, movement: selectNpcMovementState(npc) };
    const result = NpcTickResultSchema.parse(
      rules.updateNpcMovement(
        selectNpcMovementState(npc),
        {
          maximumSpeedPerFrame: vessel.maximumSpeedPerFrame,
          turnDegreesPerFrame: vessel.turnDegreesPerFrame,
          strengthPercent: combinedDurabilityPercent(npc.condition, {
            hull: vessel.maximumHull,
            shields: vessel.maximumShields,
          }),
        },
        freezeNpcTargetState({ id: target.id, kind: target.kind, position: target.location.position }),
        cameraZoom,
        npc.randomState,
        npc.combat.alert,
        npc.combat
      )
    );
    return { id: npc.id, movement: result.movement, randomState: result.randomState };
  });
}
