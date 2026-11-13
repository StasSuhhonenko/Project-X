/** Immediate optional boarding host. All intermediate worlds are detached;
 * the Transport store action publishes only the fully validated composition. */
import type { GameModule } from '../../content/game-module';
import {
  BoardingAssessmentContextSchema,
  BoardingAssessmentSchema,
  BoardingContextSchema,
  BoardingResultSchema,
} from '../contracts/boarding-rules';
import { NoticeMessageSchema, ResourceBalancesSchema } from '../model/entity-components';
import { grantOwnedWeapon } from '../model/equipment-state';
import { applyStandingDelta } from '../model/lifecycle-state';
import { parseWorldState, selectPlayerEntity, type WorldState } from '../model/world-state';
import { captureFleetShip } from './fleet';
import { applyLifecycleHit, createLifecycleDefinitions, prepareActorHit } from './lifecycle-hit';
import { resolveProgression } from './progression';

/** Sequence-numbered module text uses the existing notice owner; later Transport
 * branches replace earlier text. No new saved field or presentation state. */
function publishNotice(world: WorldState, message: string): WorldState {
  const player = selectPlayerEntity(world);
  return parseWorldState({
    ...world,
    entities: world.entities.map(entity =>
      entity.id === player.id
        ? {
            ...player,
            feedback: {
              ...player.feedback,
              notice: {
                sequence: (player.feedback.notice?.sequence ?? 0) + 1,
                code: 'ship-boarded',
                message: NoticeMessageSchema.parse(message),
              },
            },
          }
        : entity
    ),
  });
}

/** Live selected mobile actors only. Assessment is draw-free and beam range is
 * independent of eligibility. The boarded actor owns outcome randomness; the
 * progression and death owners retain their separate existing streams. */
export function boardSelectedShip(world: WorldState, game: GameModule): WorldState {
  const policy = game.rules.boarding,
    player = selectPlayerEntity(world);
  if (!policy || world.status !== 'active' || player.condition.repairing) return world;
  const target = world.entities.find(entity => entity.id === world.selectedTargetEntityId);
  if (
    target?.kind !== 'npc-ship' ||
    target.condition.hull <= 0 ||
    target.location.systemId !== player.location.systemId
  )
    return world;
  const playerVessel = game.catalog.getShipDefinition(player.definitionId),
    targetVessel = game.catalog.getShipDefinition(target.definitionId),
    system = game.definition.systems.find(system => system.id === player.location.systemId);
  if (!playerVessel || !targetVessel || !system) throw Error('Boarding requires declared vessels and system.');
  const assessment = BoardingAssessmentSchema.parse(
    policy.assessBoarding(
      BoardingAssessmentContextSchema.parse({
        playerPosition: player.location.position,
        playerHeadingDegrees: player.location.rotationDegrees,
        playerDefinitionId: player.definitionId,
        targetPosition: target.location.position,
        targetHeadingDegrees: target.location.rotationDegrees,
        targetDefinitionId: target.definitionId,
        targetStrength: target.condition.hull + target.condition.shields,
        targetMaximumStrength: targetVessel.maximumHull + targetVessel.maximumShields,
        cameraZoom: world.cameraZoom,
        targetKind: target.kind,
      })
    )
  );
  if (!assessment.eligible) return assessment.inBeamRange ? publishNotice(world, policy.beamOverMessage) : world;
  const result = BoardingResultSchema.parse(
    policy.resolveBoarding(
      BoardingContextSchema.parse({
        playerVessel,
        targetVessel,
        targetGovernmentId: target.governmentId,
        localGovernmentId: system.governmentId,
        opposingGovernmentId: system.opposingGovernmentId,
        standing: world.lifecycle.systemStanding.find(entry => entry.systemId === system.id)?.value ?? null,
        progression: world.progression,
        ownedWeaponIds: player.equipment?.ownedWeaponIds ?? [],
        randomState: target.randomState,
        alreadyOwned: world.fleet?.deployments.some(link => link.entityId === target.id) ?? false,
      })
    )
  );
  const outcome = result.outcome;
  if (outcome.kind === 'capture' && (!game.rules.fleet || !world.fleet))
    throw Error('Capture requires the fleet capability.');
  let equipment = player.equipment,
    resources = player.inventory.resources;
  if (outcome.kind === 'pillage') {
    const balance = resources[outcome.resourceId];
    if (balance === undefined) throw Error('Boarding reward references an undeclared resource.');
    const nextBalance = balance + outcome.amount;
    if (!Number.isFinite(nextBalance) || nextBalance > Number.MAX_SAFE_INTEGER)
      throw Error('Boarding reward overflow.');
    resources = ResourceBalancesSchema.parse({ ...resources, [outcome.resourceId]: nextBalance });
  }
  if (outcome.kind === 'salvage' && outcome.weaponDefinitionId !== null) {
    const weapon = game.catalog.getWeaponDefinition(outcome.weaponDefinitionId);
    if (
      !weapon ||
      !equipment ||
      !game.definition.equipment?.supportedWeaponIds.includes(weapon.id) ||
      playerVessel.sizeClass < weapon.minimumSizeClass
    )
      throw Error('Boarding salvage references unavailable equipment.');
    equipment = grantOwnedWeapon(equipment, weapon.id);
  }
  let next = parseWorldState({
    ...world,
    lifecycle: {
      ...world.lifecycle,
      systemStanding:
        result.standingDelta === 0
          ? world.lifecycle.systemStanding
          : applyStandingDelta(world.lifecycle.systemStanding, system.id, result.standingDelta),
    },
    entities: world.entities.map(entity => {
      if (entity.id === player.id) return { ...player, equipment, inventory: { ...player.inventory, resources } };
      if (entity.id === target.id) return { ...target, randomState: result.randomState };
      return entity;
    }),
  });
  next = resolveProgression(next, game.rules, game.definition.progression, { kind: 'ship-boarded' });
  if (outcome.kind === 'capture') next = captureFleetShip(next, game, target.id);
  if (result.selfDestruct) {
    const definitions = createLifecycleDefinitions(game.catalog);
    next = applyLifecycleHit(
      next,
      prepareActorHit(
        next,
        target.id,
        { kind: 'player' },
        playerVessel.sizeClass,
        null,
        player.location.position,
        world.cameraZoom,
        game.rules,
        definitions,
        game.definition.systems,
        game.definition.lifecycle,
        'self-destruct'
      ),
      definitions,
      game.definition.progression
    );
  }
  // Death settlement still runs in full. Transport's outcome is its final text,
  // independent of death notices; explosion/tallies/communication remain owned
  // by that settlement rather than duplicated here.
  return publishNotice(next, result.message);
}
