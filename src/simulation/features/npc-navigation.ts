/** One ordered NPC navigation pass shared by ordinary and equipped combat. */
import type { WorldTickDefinitions } from './advance-world';
import type { GameRules } from '../contracts/game-rules';
import { NpcTickResultSchema, freezeNpcTargetState } from '../model/npc-state';
import { selectNpcMovementState, selectWorldEntity, type WorldState } from '../model/world-state';
export function advanceNpcNavigation(world: WorldState, definitions: WorldTickDefinitions, rules: GameRules,
  cameraZoom: number, initialRandomState: number, movableIds?: ReadonlySet<string>) {
  let randomState = initialRandomState;
  const npcUpdates = world.entities.filter(entity => entity.kind === 'npc-ship').map(npc => {
    const vessel = definitions.getShipDefinition(npc.definitionId);
    if (!vessel) throw Error(`NPC ${npc.id} has an invalid vessel reference.`);
    const target = npc.navigation.targetEntityId === null ? null : selectWorldEntity(world, npc.navigation.targetEntityId);
    if (!target || npc.specialStatus.engineDisabledFrames > 0 || (movableIds && !movableIds.has(npc.id)))
      return { id: npc.id, movement: selectNpcMovementState(npc) };
    const result = NpcTickResultSchema.parse(rules.updateNpcMovement(selectNpcMovementState(npc), {
      maximumSpeedPerFrame: vessel.maximumSpeedPerFrame, turnDegreesPerFrame: vessel.turnDegreesPerFrame,
    }, freezeNpcTargetState({ id: target.id, kind: target.kind, position: target.location.position }), cameraZoom, randomState));
    randomState = result.randomState;
    return { id: npc.id, movement: result.movement };
  });
  return { npcUpdates, randomState };
}
