/** Atomic active-vessel replacement. Modules own prices and launch policy;
 * this boundary owns offer identity, balances, capacity and world publication. */
import { z } from 'zod';
import type { GameModule } from '../../content/game-module';
import { VesselPurchaseApprovalSchema, type VesselPurchaseApproval } from '../contracts/vessel-purchase';
import { totalCargoTons } from '../model/cargo-quantities';
import { ResourceBalancesSchema } from '../model/entity-components';
import { createEquipment } from '../model/equipment-state';
import { parseWorldState, selectPlayerEntity, type WorldState } from '../model/world-state';
import { authenticateVesselOffer } from './vessel-offer';

/** A displayed intent identifies an offer and its session, never an approval. */
export const VesselPurchaseIntentSchema = z
  .object({
    sessionRevision: z.number().int().nonnegative(),
    playerDefinitionId: z.number().int().positive(),
    systemId: z.number().int().positive(),
    planetEntityId: z.string().regex(/^entity-[1-9][0-9]*$/),
    /** Absent means planet; present binds the selected live station source. */
    stationEntityId: z
      .string()
      .regex(/^entity-[1-9][0-9]*$/)
      .optional(),
    vesselDefinitionId: z.number().int().positive(),
  })
  .strict()
  .readonly();
export type VesselPurchaseIntent = z.infer<typeof VesselPurchaseIntentSchema>;

/** Shared identity check for synchronous commands and asynchronous preflight. */
export function isVesselPurchaseIntentCurrent(
  world: WorldState,
  sessionRevision: number,
  intent: VesselPurchaseIntent
): boolean {
  const player = selectPlayerEntity(world);
  return (
    intent.sessionRevision === sessionRevision &&
    intent.playerDefinitionId === player.definitionId &&
    intent.systemId === player.location.systemId &&
    world.entities.some(entity => entity.kind === 'planet' && entity.id === intent.planetEntityId) &&
    (intent.stationEntityId === undefined ||
      (world.selectedTargetEntityId === intent.stationEntityId &&
        world.entities.some(
          entity =>
            entity.kind === 'station' &&
            entity.id === intent.stationEntityId &&
            entity.location.systemId === intent.systemId
        )))
  );
}

/** Reused for display, preflight and commit. A stale/invalid offer never mutates. */
export function inspectVesselOffer(
  world: WorldState,
  gameModule: GameModule,
  vesselDefinitionId: number,
  stationEntityId?: string
): VesselPurchaseApproval | null {
  const offer = authenticateVesselOffer(world, gameModule, vesselDefinitionId, stationEntityId);
  if (!offer) return null;
  const { player, nextVessel, system, planet, station } = offer;
  const currentVessel = gameModule.catalog.getShipDefinition(player.definitionId);
  if (!currentVessel) return null;
  const approval = gameModule.rules.evaluateVesselPurchase?.(
    Object.freeze({
      sourceKind: station ? 'station' : 'planet',
      currentVessel,
      nextVessel,
      system,
      standing: world.lifecycle.systemStanding.find(entry => entry.systemId === system.id)?.value ?? null,
      playerPosition: player.location.position,
      planetPosition: planet.location.position,
      cameraZoom: world.cameraZoom,
      resources: player.inventory.resources,
      motion: player.motion,
    })
  );
  if (!approval) return null;
  const parsed = VesselPurchaseApprovalSchema.parse(approval);
  if (player.inventory.resources[parsed.resourceId] === undefined) return null;
  if (parsed.refill && player.inventory.resources[parsed.refill.resourceId] === undefined) return null;
  return parsed;
}

/** Affordability and hold capacity are checked independently of preview access. */
export function quoteVesselPurchase(
  world: WorldState,
  gameModule: GameModule,
  vesselDefinitionId: number,
  stationEntityId?: string
): VesselPurchaseApproval | null {
  const approval = inspectVesselOffer(world, gameModule, vesselDefinitionId, stationEntityId);
  if (!approval) return null;
  const player = selectPlayerEntity(world);
  const cargoTons = totalCargoTons(player.inventory.cargo);
  if (
    !Number.isSafeInteger(cargoTons) ||
    cargoTons > gameModule.catalog.getShipDefinition(vesselDefinitionId)!.cargoCapacity
  )
    return null;
  if (player.inventory.resources[approval.resourceId]! < Math.max(approval.cost, approval.minimumBalance)) return null;
  return approval;
}

/** Validate all replacement fields before returning one new frozen world.
 * Identity, cargo, position, targets, actors, clock and RNG survive. Launch
 * replaces durability, primary equipment/history and motion together. */
export function purchaseVessel(
  world: WorldState,
  gameModule: GameModule,
  vesselDefinitionId: number,
  stationEntityId?: string
): WorldState {
  const approval = quoteVesselPurchase(world, gameModule, vesselDefinitionId, stationEntityId);
  if (!approval) return world;
  const vessel = gameModule.catalog.getShipDefinition(vesselDefinitionId)!;
  const player = selectPlayerEntity(world);
  const weaponId = vessel.startingWeaponIds[0];
  const weapon = weaponId === null ? null : gameModule.catalog.getWeaponDefinition(weaponId);
  if (weaponId !== null && !weapon) throw Error('Replacement primary weapon is unavailable.');
  const resources = ResourceBalancesSchema.parse({
    ...player.inventory.resources,
    [approval.resourceId]: player.inventory.resources[approval.resourceId]! - approval.cost,
    ...(approval.refill ? { [approval.refill.resourceId]: approval.refill.units } : {}),
  });
  return parseWorldState({
    ...world,
    entities: world.entities.map(entity =>
      entity.id !== player.id
        ? entity
        : {
            ...player,
            definitionId: vessel.id,
            specialStatus: {
              ...player.specialStatus,
              cloaked: approval.resetCloak ? false : player.specialStatus.cloaked,
            },
            location: { ...player.location, rotationDegrees: approval.rotationDegrees },
            motion: approval.motion,
            condition: {
              hull: vessel.maximumHull,
              shields: vessel.maximumShields,
              energy: approval.energy,
              repairing: false,
            },
            inventory: { ...player.inventory, resources },
            feedback: {
              ...player.feedback,
              notice: approval.notice
                ? {
                    ...approval.notice,
                    sequence: (player.feedback.notice?.sequence ?? 0) + 1,
                  }
                : player.feedback.notice,
            },
            equipment: gameModule.definition.equipment
              ? {
                  ...createEquipment(
                    gameModule.definition.equipment.inventoryCapacity,
                    vessel.startingWeaponIds,
                    id => gameModule.catalog.getWeaponDefinition(id)!.cooldownFrames,
                    player.equipment?.marketAdjustment ?? 0
                  ),
                  technologyWeaponIds: player.equipment?.technologyWeaponIds ?? [],
                  revision: (player.equipment?.revision ?? 0) + 1,
                }
              : null,
            armament: {
              weaponDefinitionId: weaponId,
              cooldownRemainingFrames: weapon?.cooldownFrames ?? 0,
              shotSequence: 0,
              resolvedShotSequence: 0,
              lastAcceptedShot: null,
            },
          }
    ),
  });
}
