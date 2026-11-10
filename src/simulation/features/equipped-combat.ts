/** Three-channel orchestration reuses the established fire/hit/effect consumers.
 * The private draft carries sequential energy, cloak, deaths and allocator facts;
 * only the final tick is returned to the store. No channel publishes on its own. */
import type { ShipDefinition } from '../../content/schemas/game-content';
import type { ProgressionEvent } from '../contracts/progression-rules';
import { equipmentArmaments } from '../model/equipment-state';
import type { PlayerMovementState } from '../model/player-state';
import { commitWorldTick, selectNpcMovementState, selectPlayerEntity, type WorldState } from '../model/world-state';
import type { AdvanceWorldInput } from './advance-world';
import { advanceCombatEffects } from './combat-effects';
import { applyLifecycleHit, createLifecycleDefinitions, prepareLifecycleHit } from './lifecycle-hit';
import { advanceNpcCombat, applyPlayerShotResponse } from './npc-combat';
import { updatePrimaryWeapon } from './primary-weapon';
import { resolveProgression } from './progression';
import { createPrimaryProjectile } from './projectiles';
import { advancePlayerRepair } from './repair';

export function advanceEquippedCombat(
  input: AdvanceWorldInput,
  moved: PlayerMovementState,
  vessel: ShipDefinition,
  cameraZoom: number,
  requested: readonly boolean[],
  /** Passive recharge already resolved from tick-entry state; see shield-recharge.ts. */
  playerShields?: number
): WorldState {
  const { world, definitions, rules, lifecycle, progression, combatGeometry, systems = [] } = input;
  const originalPlayer = selectPlayerEntity(world);
  const originalEquipment = originalPlayer.equipment!;
  const lifecycleDefinitions = createLifecycleDefinitions(definitions);
  const progressionEvents: Omit<Extract<ProgressionEvent, { kind: 'weapon-fire' }>, 'progression' | 'randomState'>[] =
    [];
  let draft = world;
  let playerMovement = moved;
  const armaments = equipmentArmaments(originalPlayer).map((armament, channel) => {
    const weapon =
      armament.weaponDefinitionId === null ? null : definitions.getWeaponDefinition(armament.weaponDefinitionId);
    if (armament.weaponDefinitionId !== null && !weapon) throw new Error('Equipped weapon definition is unavailable.');
    const result = updatePrimaryWeapon(
      draft,
      playerMovement,
      vessel,
      weapon ?? null,
      requested[channel] === true,
      cameraZoom,
      rules,
      lifecycle,
      armament
    );
    draft = applyPlayerShotResponse(draft, armament, result.armament, rules, result.specialEmission, input.systems);
    if (result.progressionEvent) progressionEvents.push(result.progressionEvent);
    playerMovement = result.playerMovement;
    const projectile = createPrimaryProjectile(
      draft,
      playerMovement,
      result.armament,
      rules,
      combatGeometry,
      armament.shotSequence
    );
    const consumed = projectile
      ? { ...result.armament, resolvedShotSequence: result.armament.shotSequence }
      : result.armament;
    if (projectile || result.specialEmission) {
      const emission = projectile ?? result.specialEmission!;
      if (
        emission.id !== `entity-${draft.nextEntitySequence}` ||
        emission.spawnedTick !== world.tick + 1 ||
        emission.weaponDefinitionId !== consumed.lastAcceptedShot?.weaponDefinitionId ||
        consumed.shotSequence !== armament.shotSequence + 1
      )
        throw new Error('Channel emission does not match its command.');
      if (!Number.isSafeInteger(draft.nextEntitySequence + 1)) throw new Error('Equipment effect allocator overflow.');
      draft = {
        ...draft,
        nextEntitySequence: draft.nextEntitySequence + 1,
        projectiles: projectile ? [...draft.projectiles, projectile] : draft.projectiles,
        specialEffects: result.specialEmission
          ? [...draft.specialEffects, result.specialEmission]
          : draft.specialEffects,
      };
    }
    if (result.specialStatus)
      draft = {
        ...draft,
        entities: draft.entities.map(e =>
          e.id === originalPlayer.id
            ? {
                ...selectPlayerEntity(draft),
                specialStatus: { ...selectPlayerEntity(draft).specialStatus, cloaked: result.specialStatus!.cloaked },
              }
            : e
        ),
      };
    const lifecycleHit = prepareLifecycleHit(
      draft,
      consumed,
      vessel,
      weapon ?? null,
      playerMovement.position,
      cameraZoom,
      rules,
      lifecycleDefinitions,
      systems,
      lifecycle
    );
    if (lifecycleHit) {
      draft = applyLifecycleHit(draft, lifecycleHit, lifecycleDefinitions, progression);
      return { ...consumed, resolvedShotSequence: consumed.shotSequence };
    }
    return { ...consumed, resolvedShotSequence: consumed.shotSequence };
  });
  // Player-only commit; the shared NPC phase runs after repair and keeps newly
  // generated actors out until the next tick.
  const npcUpdates = draft.entities
    .filter(entity => entity.kind === 'npc-ship')
    .map(npc => ({ id: npc.id, movement: selectNpcMovementState(npc) }));
  const currentPlayer = selectPlayerEntity(draft);
  if (currentPlayer.feedback.notice !== originalPlayer.feedback.notice)
    playerMovement = { ...playerMovement, notice: currentPlayer.feedback.notice };
  const committed = commitWorldTick(draft, {
    deferNpcStatusCountdown: true,
    playerMovement,
    cameraZoom,
    npcUpdates,
    // Navigation uses actor streams; the draft's world stream already carries
    // every lifecycle draw taken by this tick's firing channels.
    randomState: draft.randomState,
    armament: armaments[0]!,
    equipment: { ...originalEquipment, additionalArmaments: [armaments[1]!, armaments[2]!] },
    specialStatus: {
      ...currentPlayer.specialStatus,
      hitFlag: 0,
      engineDisabledFrames: Math.max(0, originalPlayer.specialStatus.engineDisabledFrames - 1),
    },
    ...(playerShields === undefined ? {} : { playerShields }),
  });
  const progressed = progressionEvents.reduce(
    (state, event) => resolveProgression(state, rules, input.progression, event),
    committed
  );
  const npcPhase = advanceNpcCombat(
    advancePlayerRepair(progressed, vessel, rules),
    input,
    new Set(world.entities.map(entity => entity.id))
  );
  if (npcPhase.status !== 'active') return npcPhase;
  return advanceCombatEffects(npcPhase, input);
}
