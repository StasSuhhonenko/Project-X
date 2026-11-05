import { advanceEquippedCombat } from './equipped-combat';
import { advanceNpcNavigation } from './npc-navigation';
/** Pure orchestration for one authoritative simulation tick. */
import { advanceSpecialEffects } from './special-weapons';
import type { EntityDefinition, ShipDefinition, WeaponDefinition } from '../../content/schemas/game-content';
import type { LifecycleDefinition } from '../../content/schemas/lifecycle-content';
import type { SystemDefinition, GameModuleDefinition } from '../../content/schemas/game-module';
import { PlayerControlsSchema } from '../commands/player-controls';
import type { GameRules } from '../contracts/game-rules';
import {
  commitWorldTick,
  selectPlayerEntity,
  selectPlayerMovementState,
  type WorldState,
} from '../model/world-state';
import { updatePrimaryWeapon } from './primary-weapon';
import { resolvePrimaryHit } from './primary-hit';
import { settleNpcDestruction } from './destruction';
import { advancePlayerRepair } from './repair';
import { prepareLifecycleHit, applyLifecycleHit } from './lifecycle-hit';
import { createPrimaryProjectile, advanceProjectiles } from './projectiles';

/**
 * Read-only definition access needed by a tick. Keeping this narrower than the
 * full catalog makes the simulation dependency explicit and easy to test.
 */
export interface WorldTickDefinitions {
  getEntityDefinition?(id: number): EntityDefinition | undefined;
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
  readonly systems?: readonly SystemDefinition[];
  readonly lifecycle?: LifecycleDefinition | undefined;
  readonly visuals?:GameModuleDefinition['visuals'] | undefined;
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
export function advanceWorld({ world, controls, zoomLevels, definitions, rules, systems = [], lifecycle, visuals }: AdvanceWorldInput): WorldState {
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
  const movedPlayer = rules.updatePlayerMovement(playerMovement, playerEntity.equipment ? { ...vessel, ownedWeaponIds: playerEntity.equipment.ownedWeaponIds } : vessel, command, cameraZoom);

  if (playerEntity.equipment) return advanceEquippedCombat(
    { world, controls, zoomLevels, definitions, rules, systems, lifecycle, visuals }, movedPlayer, vessel, cameraZoom,
    [command.firePrimary === true, command.fireSecondary === true, command.fireTertiary === true]);

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
    lifecycle,
  );
  const lifecycleDefinitions = {
    getEntityDefinition: (id: number) => definitions.getEntityDefinition?.(id) ?? definitions.getShipDefinition(id),
    getShipDefinition: (id: number) => definitions.getShipDefinition(id),
  };
  const projectileEmission=createPrimaryProjectile(world,weaponTick.playerMovement,weaponTick.armament,rules,visuals);
  const consumedArmament=projectileEmission
    ? Object.freeze({...weaponTick.armament,resolvedShotSequence:weaponTick.armament.shotSequence}):weaponTick.armament;
  const lifecycleHit = prepareLifecycleHit(world, consumedArmament, vessel, primaryWeapon ?? null,
    weaponTick.playerMovement.position, cameraZoom, rules, lifecycleDefinitions, systems, lifecycle);
  const hit = lifecycleHit ? {
    armament: Object.freeze({ ...weaponTick.armament, resolvedShotSequence: weaponTick.armament.shotSequence }),
    npcDurabilityUpdates: lifecycleHit.condition ? [{ id: lifecycleHit.targetId, condition: lifecycleHit.condition }] : [],
  } : resolvePrimaryHit(world, consumedArmament, vessel, primaryWeapon ?? null, rules);

  const { npcUpdates, randomState } = advanceNpcNavigation(world, definitions, rules, cameraZoom,
    lifecycleHit?.result.randomState ?? world.randomState);

  const committed = commitWorldTick(world, {
    playerMovement: weaponTick.playerMovement,
    cameraZoom,
    npcUpdates,
    randomState,
    armament: hit.armament,
    projectileEmission,
    specialEmission: weaponTick.specialEmission,
    specialStatus: weaponTick.specialStatus,
    npcDurabilityUpdates: hit.npcDurabilityUpdates,
  });
  const settled=settleNpcDestruction(advancePlayerRepair(applyLifecycleHit(committed, lifecycleHit, lifecycleDefinitions), vessel, rules));
  return advanceSpecialEffects(advanceProjectiles(settled,{rules,definitions,systems,visuals,lifecycle}), rules, visuals);
}
