/** Pure orchestration for one authoritative simulation tick. */
import type { ShipDefinition, WeaponDefinition } from '../../content/schemas/game-content';
import { PlayerControlsSchema } from '../commands/player-controls';
import type { GameRules } from '../contracts/game-rules';
import { NpcTickResultSchema, freezeNpcTargetState } from '../model/npc-state';
import {
  commitWorldTick,
  selectNpcMovementState,
  selectPlayerEntity,
  selectPlayerMovementState,
  selectWorldEntity,
  type WorldState,
} from '../model/world-state';
import { updatePrimaryWeapon } from './primary-weapon';
import { resolvePrimaryHit } from './primary-hit';
import { settleNpcDestruction } from './destruction';
import { advancePlayerRepair } from './repair';

/**
 * Read-only definition access needed by a tick. Keeping this narrower than the
 * full catalog makes the simulation dependency explicit and easy to test.
 */
export interface WorldTickDefinitions {
  getShipDefinition(id: number): ShipDefinition | undefined;
  getWeaponDefinition(id: number): WeaponDefinition | undefined;
}

export interface AdvanceWorldInput {
  readonly world: WorldState;
  /** Commands are validated here, at the simulation boundary, before any rule runs. */
  readonly controls: unknown;
  /** Validated module zoom denominators, ordered from nearest to farthest. */
  readonly zoomLevels: readonly number[];
  readonly definitions: WorldTickDefinitions;
  readonly rules: GameRules;
}

function selectTickZoom(world: WorldState, zoomLevels: readonly number[], zoomIn: boolean,
  zoomOut: boolean): number {
  let levelIndex = zoomLevels.indexOf(world.cameraZoom);
  if (levelIndex < 0) throw new Error('Active zoom is absent from the selected module.');
  if (zoomOut && levelIndex < zoomLevels.length - 1) levelIndex += 1;
  if (zoomIn && levelIndex > 0) levelIndex -= 1;
  return zoomLevels[levelIndex]!;
}

/**
 * Advance exactly one fixed simulation tick without reading a store, renderer,
 * browser API or ambient clock. The established order is zoom selection,
 * player movement, primary weapon evaluation, NPC movement, then one validated
 * immutable world commit. An exception returns no partial result and leaves the
 * input world untouched for the caller to retain.
 */
export function advanceWorld({ world, controls, zoomLevels, definitions, rules }: AdvanceWorldInput): WorldState {
  if (world.status !== 'active') throw new Error('A destroyed world cannot advance.');
  const command = PlayerControlsSchema.parse(controls);
  const playerEntity = selectPlayerEntity(world);
  const playerMovement = selectPlayerMovementState(world);
  const vessel = definitions.getShipDefinition(playerEntity.definitionId);
  if (!vessel) throw new Error(`Missing active vessel ${playerEntity.definitionId}.`);

  const cameraZoom = selectTickZoom(
    world,
    zoomLevels,
    command.zoomIn === true,
    command.zoomOut === true,
  );
  const movedPlayer = rules.updatePlayerMovement(playerMovement, vessel, command, cameraZoom);

  const primaryWeaponId = selectPlayerEntity(world).armament.weaponDefinitionId;
  const primaryWeapon = primaryWeaponId === null ? null : definitions.getWeaponDefinition(primaryWeaponId);
  if (primaryWeaponId !== null && !primaryWeapon) {
    throw new Error(`Missing primary weapon ${primaryWeaponId}.`);
  }
  const weaponTick = updatePrimaryWeapon(
    world,
    movedPlayer,
    vessel,
    primaryWeapon ?? null,
    command.firePrimary === true,
    cameraZoom,
    rules,
  );
  const hit = resolvePrimaryHit(world, weaponTick.armament, vessel, primaryWeapon ?? null, rules);

  let randomState = world.randomState;
  const npcUpdates = world.entities.filter(entity => entity.kind === 'npc-ship').map(npc => {
    const npcVessel = definitions.getShipDefinition(npc.definitionId);
    const target = npc.navigation.targetEntityId === null
      ? undefined : selectWorldEntity(world, npc.navigation.targetEntityId);
    if (!npcVessel) throw new Error(`NPC ${npc.id} has an invalid vessel reference.`);
    // Destruction cleanup deliberately leaves surviving ships targetless. Until
    // the later combat-AI slice reacquires a target, preserve their movement
    // state without invoking a module rule with a fabricated destination.
    if (!target) return { id: npc.id, movement: selectNpcMovementState(npc) };
    const result = NpcTickResultSchema.parse(rules.updateNpcMovement(
      selectNpcMovementState(npc),
      {
        maximumSpeedPerFrame: npcVessel.maximumSpeedPerFrame,
        turnDegreesPerFrame: npcVessel.turnDegreesPerFrame,
      },
      freezeNpcTargetState({ id: target.id, kind: target.kind, position: target.location.position }),
      cameraZoom,
      randomState,
    ));
    randomState = result.randomState;
    return { id: npc.id, movement: result.movement };
  });

  const committed = commitWorldTick(world, {
    playerMovement: weaponTick.playerMovement,
    cameraZoom,
    npcUpdates,
    randomState,
    armament: hit.armament,
    npcDurabilityUpdates: hit.npcDurabilityUpdates,
  });
  return settleNpcDestruction(advancePlayerRepair(committed, vessel, rules));
}
