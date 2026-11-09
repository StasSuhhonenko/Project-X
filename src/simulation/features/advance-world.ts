/** Pure orchestration for one authoritative simulation tick. */
import type { EntityDefinition, ShipDefinition, WeaponDefinition } from '../../content/schemas/game-content';
import type { GameModuleDefinition, SystemDefinition } from '../../content/schemas/game-module';
import type { LifecycleDefinition } from '../../content/schemas/lifecycle-content';
import { PlayerControlsSchema } from '../commands/player-controls';
import type { GameRules } from '../contracts/game-rules';
import type { ProgressionDefinition } from '../model/progression-state';
import {
  commitWorldTick,
  selectNpcMovementState,
  selectPlayerEntity,
  selectPlayerMovementState,
  type WorldState,
} from '../model/world-state';
import { advanceCombatEffects } from './combat-effects';
import { advanceEquippedCombat } from './equipped-combat';
import { applyLifecycleHit, createLifecycleDefinitions, prepareLifecycleHit } from './lifecycle-hit';
import { advanceNpcCombat, applyPlayerShotResponse } from './npc-combat';
import { updatePrimaryWeapon } from './primary-weapon';
import { resolveProgression } from './progression';
import { createPrimaryProjectile } from './projectiles';
import { advancePlayerRepair } from './repair';

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
  readonly progression?: ProgressionDefinition | undefined;
  readonly world: WorldState;
  /** Commands are validated here, at the simulation boundary, before any rule runs. */
  readonly controls: unknown;
  /** Validated module zoom denominators, ordered from nearest to farthest. */
  readonly zoomLevels: readonly number[];
  readonly definitions: WorldTickDefinitions;
  readonly rules: GameRules;
  readonly systems?: readonly SystemDefinition[];
  readonly lifecycle?: LifecycleDefinition | undefined;
  readonly combatGeometry?: GameModuleDefinition['combatGeometry'] | undefined;
}

function selectTickZoom(world: WorldState, zoomLevels: readonly number[], zoomIn: boolean, zoomOut: boolean): number {
  let levelIndex = zoomLevels.indexOf(world.cameraZoom);
  if (levelIndex < 0) throw new Error('Active zoom is absent from the selected module.');
  if (zoomOut && levelIndex < zoomLevels.length - 1) levelIndex += 1;
  if (zoomIn && levelIndex > 0) levelIndex -= 1;
  return zoomLevels[levelIndex]!;
}

/**
 * Advance exactly one fixed simulation tick without reading a store, renderer,
 * browser API or ambient clock. The established order is zoom selection,
 * player movement, player fire/immediate hits, repair, NPC decisions/beams then
 * movement, projectiles/special effects and destruction. Terminal incoming hits
 * return immediately. The store publishes only the completed immutable candidate.
 * An exception returns no partial result and leaves the input world untouched.
 */
export function advanceWorld({
  progression,
  world,
  controls,
  zoomLevels,
  definitions,
  rules,
  systems = [],
  lifecycle,
  combatGeometry,
}: AdvanceWorldInput): WorldState {
  if (world.status !== 'active') throw new Error('A destroyed world cannot advance.');
  const command = PlayerControlsSchema.parse(controls);
  const playerEntity = selectPlayerEntity(world);
  const playerMovement = selectPlayerMovementState(world);
  const vessel = definitions.getShipDefinition(playerEntity.definitionId);
  if (!vessel) throw new Error(`Missing active vessel ${playerEntity.definitionId}.`);

  const cameraZoom = selectTickZoom(world, zoomLevels, command.zoomIn === true, command.zoomOut === true);
  const movedPlayer = rules.updatePlayerMovement(
    playerMovement,
    playerEntity.equipment ? { ...vessel, ownedWeaponIds: playerEntity.equipment.ownedWeaponIds } : vessel,
    command,
    cameraZoom
  );

  if (playerEntity.equipment)
    return advanceEquippedCombat(
      { world, controls, zoomLevels, definitions, rules, systems, lifecycle, combatGeometry, progression },
      movedPlayer,
      vessel,
      cameraZoom,
      [command.firePrimary === true, command.fireSecondary === true, command.fireTertiary === true]
    );

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
    lifecycle
  );
  const lifecycleDefinitions = createLifecycleDefinitions(definitions);
  const projectileEmission = createPrimaryProjectile(
    world,
    weaponTick.playerMovement,
    weaponTick.armament,
    rules,
    combatGeometry
  );
  const consumedArmament = projectileEmission
    ? Object.freeze({ ...weaponTick.armament, resolvedShotSequence: weaponTick.armament.shotSequence })
    : weaponTick.armament;
  const responding = applyPlayerShotResponse(
    world,
    playerEntity.armament,
    weaponTick.armament,
    rules,
    weaponTick.specialEmission,
    systems
  );
  const lifecycleHit = prepareLifecycleHit(
    responding,
    consumedArmament,
    vessel,
    primaryWeapon ?? null,
    weaponTick.playerMovement.position,
    cameraZoom,
    rules,
    lifecycleDefinitions,
    systems,
    lifecycle
  );
  // The settlement owner handles every live ship. Absent/ineligible targets
  // consume accepted history without a second damage/destruction path.
  const armament = Object.freeze({ ...consumedArmament, resolvedShotSequence: consumedArmament.shotSequence });

  // Commit player state/history first, retaining pre-phase NPC movement/status.
  const npcUpdates = responding.entities
    .filter(entity => entity.kind === 'npc-ship')
    .map(npc => ({ id: npc.id, movement: selectNpcMovementState(npc) }));
  // Navigation draws from actor streams; only lifecycle settlement advances the world stream.
  const randomState = world.randomState;

  const committed = commitWorldTick(responding, {
    deferNpcStatusCountdown: true,
    playerMovement: weaponTick.playerMovement,
    cameraZoom,
    npcUpdates,
    randomState,
    armament,
    projectileEmission,
    specialEmission: weaponTick.specialEmission,
    specialStatus: weaponTick.specialStatus,
    npcDurabilityUpdates: [],
  });
  // Immediate player hits remove victims before NPC decisions; replacements
  // are excluded by the tick-entry ID snapshot below.
  const settled = applyLifecycleHit(committed, lifecycleHit, lifecycleDefinitions, progression);
  const progressed = weaponTick.progressionEvent
    ? resolveProgression(settled, rules, progression, weaponTick.progressionEvent)
    : settled;
  const npcPhase = advanceNpcCombat(
    advancePlayerRepair(progressed, vessel, rules),
    { definitions, rules, systems, lifecycle, progression, combatGeometry },
    new Set(world.entities.map(entity => entity.id))
  );
  if (npcPhase.status !== 'active') return npcPhase;
  return advanceCombatEffects(npcPhase, { definitions, rules, systems, lifecycle, combatGeometry, progression });
}
