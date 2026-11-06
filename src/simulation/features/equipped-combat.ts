/** Three-channel orchestration reuses the established fire/hit/effect consumers.
 * The private draft carries sequential energy, cloak, deaths and allocator facts;
 * only the final tick is returned to the store. No channel publishes on its own. */
import type { ShipDefinition } from '../../content/schemas/game-content';
import type { PlayerMovementState } from '../model/player-state';
import { equipmentArmaments } from '../model/equipment-state';
import { freezeWorld } from '../model/world-schema';
import { selectPlayerEntity, commitWorldTick, type WorldState } from '../model/world-state';
import type { AdvanceWorldInput } from './advance-world';
import { updatePrimaryWeapon } from './primary-weapon';
import { createPrimaryProjectile, advanceProjectiles } from './projectiles';
import { prepareLifecycleHit, applyLifecycleHit } from './lifecycle-hit';
import { resolvePrimaryHit } from './primary-hit';
import { settleNpcDestruction } from './destruction';
import { advancePlayerRepair } from './repair';
import { advanceSpecialEffects } from './special-weapons';
import { advanceNpcNavigation } from './npc-navigation';

export function advanceEquippedCombat(input: AdvanceWorldInput, moved: PlayerMovementState,
  vessel: ShipDefinition, cameraZoom: number, requested: readonly boolean[]): WorldState {
  const { world, definitions, rules, lifecycle, combatGeometry, systems = [] } = input;
  const originalPlayer = selectPlayerEntity(world);
  const originalEquipment = originalPlayer.equipment!;
  const lifecycleDefinitions = {
    getEntityDefinition: (id: number) => definitions.getEntityDefinition?.(id) ?? definitions.getShipDefinition(id),
    getShipDefinition: (id: number) => definitions.getShipDefinition(id),
  };
  let draft = world;
  let playerMovement = moved;
  const armaments = equipmentArmaments(originalPlayer).map((armament, channel) => {
    const weapon = armament.weaponDefinitionId === null ? null : definitions.getWeaponDefinition(armament.weaponDefinitionId);
    if (armament.weaponDefinitionId !== null && !weapon) throw Error('Equipped weapon definition is unavailable.');
    const result = updatePrimaryWeapon(draft, playerMovement, vessel, weapon ?? null,
      requested[channel] === true, cameraZoom, rules, lifecycle, armament);
    playerMovement = result.playerMovement;
    const projectile = createPrimaryProjectile(draft, playerMovement, result.armament, rules, combatGeometry, armament.shotSequence);
    const consumed = projectile ? { ...result.armament, resolvedShotSequence: result.armament.shotSequence } : result.armament;
    if (projectile || result.specialEmission) {
      const emission = projectile ?? result.specialEmission!;
      if (emission.id !== `entity-${draft.nextEntitySequence}` || emission.spawnedTick !== world.tick + 1
        || emission.weaponDefinitionId !== consumed.lastAcceptedShot?.weaponDefinitionId
        || consumed.shotSequence !== armament.shotSequence + 1) throw Error('Channel emission does not match its command.');
      if (!Number.isSafeInteger(draft.nextEntitySequence + 1)) throw Error('Equipment effect allocator overflow.');
      draft = { ...draft, nextEntitySequence: draft.nextEntitySequence + 1,
        projectiles: projectile ? [...draft.projectiles, projectile] : draft.projectiles,
        specialEffects: result.specialEmission ? [...draft.specialEffects, result.specialEmission] : draft.specialEffects };
    }
    if (result.specialStatus) draft = { ...draft, entities: draft.entities.map(e => e.id === originalPlayer.id
      ? { ...selectPlayerEntity(draft), specialStatus: { ...selectPlayerEntity(draft).specialStatus, cloaked: result.specialStatus!.cloaked } } : e) };
    const lifecycleHit = prepareLifecycleHit(draft, consumed, vessel, weapon ?? null, playerMovement.position,
      cameraZoom, rules, lifecycleDefinitions, systems, lifecycle);
    if (lifecycleHit) {
      draft = applyLifecycleHit(draft, lifecycleHit, lifecycleDefinitions);
      draft = { ...draft, randomState: lifecycleHit.result.randomState };
      return { ...consumed, resolvedShotSequence: consumed.shotSequence };
    }
    const hit = resolvePrimaryHit(draft, consumed, vessel, weapon ?? null, rules);
    if (hit.npcDurabilityUpdates.length) draft = settleNpcDestruction(freezeWorld({ ...draft,
      entities: draft.entities.map(e => {
        const update = hit.npcDurabilityUpdates.find(update => update.id === e.id);
        return e.kind === 'npc-ship' && update ? { ...e, condition: update.condition } : e;
      }) }));
    return hit.armament;
  });
  // Newly generated actors wait until the next tick; original survivors move
  // once. This also preserves the allocator/death order across firing channels.
  const navigation = advanceNpcNavigation(draft, definitions, rules, cameraZoom, draft.randomState,
    new Set(world.entities.map(e => e.id)));
  const currentPlayer = selectPlayerEntity(draft);
  if (currentPlayer.feedback.notice !== originalPlayer.feedback.notice)
    playerMovement = { ...playerMovement, notice: currentPlayer.feedback.notice };
  const committed = commitWorldTick(draft, { playerMovement, cameraZoom, ...navigation,
    armament: armaments[0]!, equipment: { ...originalEquipment,
      additionalArmaments: [armaments[1]!, armaments[2]!] },
    specialStatus: { ...currentPlayer.specialStatus, hitFlag: 0,
      engineDisabledFrames: Math.max(0, originalPlayer.specialStatus.engineDisabledFrames - 1) } });
  return advanceSpecialEffects(advanceProjectiles(advancePlayerRepair(committed, vessel, rules),
    { rules, definitions, systems, combatGeometry, lifecycle }), rules, combatGeometry);
}
