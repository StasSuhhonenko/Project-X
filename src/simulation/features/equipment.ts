/** Atomic equipment operations. Modules quote prices; this owner validates
 * session/offer/owned-copy identity and publishes payment and slot changes once. */
import { z } from 'zod';
import type { GameModule } from '../../content/game-module';
import { EquipmentMarketSchema, EquipmentPriceSchema } from '../contracts/equipment-rules';
import { createArmament } from '../model/armament-state';
import { RuntimeEntityIdSchema } from '../model/entity-components';
import { canUseOwnedWeapon, createEquipment, equipmentArmaments, FiringChannelSchema } from '../model/equipment-state';
import { parseWorldState, selectPlayerEntity, type WorldState } from '../model/world-state';

export const EquipmentIntentSchema = z
  .object({
    sessionRevision: z.number().int().nonnegative(),
    revision: z.number().int().nonnegative(),
    systemId: z.number().int().positive(),
    playerDefinitionId: z.number().int().positive(),
    operation: z.enum(['purchase', 'load', 'unequip', 'sell']),
    weaponDefinitionId: z.number().int().positive().nullable(),
    inventoryIndex: z.number().int().nonnegative().max(63),
    channel: FiringChannelSchema,
    stationEntityId: RuntimeEntityIdSchema.nullable(),
  })
  .strict()
  .readonly();
export type EquipmentIntent = z.infer<typeof EquipmentIntentSchema>;

/** Entering a system samples its price once. Restore/refit never re-sample. */
export function enterEquipmentMarket(world: WorldState, game: Pick<GameModule, 'definition' | 'rules'>): WorldState {
  const player = selectPlayerEntity(world);
  if (!player.equipment) return world;
  const system = game.definition.systems.find(s => s.id === player.location.systemId)!;
  const market = EquipmentMarketSchema.parse(
    game.rules.createEquipmentMarket?.(Object.freeze({ system, randomState: world.randomState })) ?? {
      marketAdjustment: 0,
      randomState: world.randomState,
    }
  );
  if (
    game.rules.validateEquipmentMarket &&
    game.rules.validateEquipmentMarket(system, market.marketAdjustment) !== true
  )
    throw Error('Invalid equipment market policy result.');
  return parseWorldState({
    ...world,
    randomState: market.randomState,
    entities: world.entities.map(e =>
      e.id === player.id
        ? { ...player, equipment: { ...player.equipment, marketAdjustment: market.marketAdjustment } }
        : e
    ),
  });
}

/** New hull defaults initialize ownership and all channels together. */
export function initializeEquipment(world: WorldState, game: GameModule): WorldState {
  const config = game.definition.equipment;
  if (!config) return world;
  const player = selectPlayerEntity(world),
    vessel = game.catalog.getShipDefinition(player.definitionId)!;
  return parseWorldState({
    ...world,
    entities: world.entities.map(e =>
      e.id === player.id
        ? {
            ...player,
            equipment: createEquipment(
              config.inventoryCapacity,
              vessel.startingWeaponIds,
              id => game.catalog.getWeaponDefinition(id)!.cooldownFrames,
              0
            ),
          }
        : e
    ),
  });
}

/** Assessment and commit share this sole eligibility/price implementation. */
export const EquipmentAssessmentSchema = z
  .object({
    price: EquipmentPriceSchema.nullable(),
    refusal: z.enum(['unavailable', 'ship-too-small', 'duplicate', 'inventory-full', 'funds']).nullable(),
  })
  .strict()
  .readonly();
export type EquipmentAssessment = z.infer<typeof EquipmentAssessmentSchema>;
export function assessEquipment(
  world: WorldState,
  game: GameModule,
  weaponId: number,
  operation: 'purchase' | 'sell'
): EquipmentAssessment {
  const refused = (refusal: NonNullable<EquipmentAssessment['refusal']>): EquipmentAssessment =>
    Object.freeze({ price: null, refusal });
  const player = selectPlayerEntity(world),
    equipment = player.equipment;
  const config = game.definition.equipment,
    weapon = game.catalog.getWeaponDefinition(weaponId);
  const vessel = game.catalog.getShipDefinition(player.definitionId);
  const system = game.definition.systems.find(s => s.id === player.location.systemId);
  if (
    world.status !== 'active' ||
    player.condition.repairing ||
    !equipment ||
    !weapon ||
    !vessel ||
    !system ||
    !config?.supportedWeaponIds.includes(weaponId)
  )
    return refused('unavailable');
  if (operation === 'purchase') {
    const station = world.entities.find(e => e.id === world.selectedTargetEntityId && e.kind === 'station');
    if (
      !station ||
      station.kind !== 'station' ||
      !system.stations.find(s => s.id === station.stationId)?.equipmentOffers?.includes(weaponId)
    )
      return refused('unavailable');
    if (vessel.sizeClass < weapon.minimumSizeClass) return refused('ship-too-small');
    if (config.technologyWeaponIds.includes(weaponId) && equipment.technologyWeaponIds.includes(weaponId))
      return refused('duplicate');
    if (!config.technologyWeaponIds.includes(weaponId) && !equipment.ownedWeaponIds.includes(null))
      return refused('inventory-full');
  }
  if (operation === 'sell' && (!equipment.ownedWeaponIds.includes(weaponId) || system.initialPopulationBillions <= 0))
    return refused('unavailable');
  const price = game.rules.evaluateEquipmentPrice?.(
    Object.freeze({
      operation,
      vessel,
      weapon,
      system,
      marketAdjustment: equipment.marketAdjustment,
      playerPosition: player.location.position,
      cameraZoom: world.cameraZoom,
    })
  );
  if (!price) return refused('unavailable');
  const parsed = EquipmentPriceSchema.parse(price),
    balance = player.inventory.resources[parsed.resourceId];
  if (balance === undefined) return refused('unavailable');
  return Object.freeze({
    price: parsed,
    refusal: operation === 'purchase' && balance < Math.max(parsed.minimumBalance, parsed.amount) ? 'funds' : null,
  });
}
/** Quotes grant no mutation authority; commands assess current facts again. */
export function quoteEquipment(world: WorldState, game: GameModule, weaponId: number, operation: 'purchase' | 'sell') {
  const assessment = assessEquipment(world, game, weaponId, operation);
  return assessment.refusal === null ? assessment.price : null;
}

/** Rejection returns the exact previous world. A stale view cannot spend twice,
 * move a replacement item, or act on a station selected in a later session. */
export function applyEquipmentIntent(
  world: WorldState,
  game: GameModule,
  sessionRevision: number,
  input: EquipmentIntent
): WorldState {
  const intent = EquipmentIntentSchema.parse(input);
  const player = selectPlayerEntity(world),
    equipment = player.equipment,
    config = game.definition.equipment;
  if (
    world.status !== 'active' ||
    player.condition.repairing ||
    !equipment ||
    !config ||
    intent.sessionRevision !== sessionRevision ||
    intent.revision !== equipment.revision ||
    intent.systemId !== player.location.systemId ||
    intent.playerDefinitionId !== player.definitionId
  )
    return world;
  const id = intent.weaponDefinitionId;
  const channels = [...equipmentArmaments(player)];
  let owned = [...equipment.ownedWeaponIds],
    technologies = [...equipment.technologyWeaponIds];
  let resources = player.inventory.resources;
  if (intent.operation === 'purchase') {
    if (id === null || intent.stationEntityId !== world.selectedTargetEntityId) return world;
    const price = quoteEquipment(world, game, id, 'purchase');
    if (!price) return world;
    const remainder = resources[price.resourceId]! - price.amount;
    resources = { ...resources, [price.resourceId]: price.roundBalanceDown ? Math.floor(remainder) : remainder };
    if (config.technologyWeaponIds.includes(id)) technologies.push(id);
    if (!config.technologyWeaponIds.includes(id)) owned[owned.indexOf(null)] = id;
  }
  if (intent.operation === 'load' || intent.operation === 'sell') {
    if (id === null || owned[intent.inventoryIndex] !== id) return world;
    const weapon = game.catalog.getWeaponDefinition(id);
    if (!weapon || !config.supportedWeaponIds.includes(id)) return world;
    if (intent.operation === 'load') {
      if (!canUseOwnedWeapon(game.catalog.getShipDefinition(player.definitionId)!, weapon)) return world;
      const count = owned.filter(ownedId => ownedId === id).length;
      const equipped = channels.filter(channel => channel.weaponDefinitionId === id).length;
      // Original loader moves the first matching channel when every owned copy
      // is already loaded. Duplicate copies may occupy different channels.
      if (count <= equipped) {
        const first = channels.findIndex(channel => channel.weaponDefinitionId === id);
        if (first >= 0) channels[first] = createArmament(null);
      }
      channels[intent.channel] = createArmament(id, weapon.cooldownFrames);
    }
    if (intent.operation === 'sell') {
      const price = quoteEquipment(world, game, id, 'sell');
      if (!price) return world;
      resources = { ...resources, [price.resourceId]: resources[price.resourceId]! + price.amount };
      // Original sale removes the first owned copy and clears EVERY matching
      // channel even if another owned copy survives.
      owned[owned.indexOf(id)] = null;
      channels.forEach((channel, index) => {
        if (channel.weaponDefinitionId === id) channels[index] = createArmament(null);
      });
    }
  }
  if (intent.operation === 'unequip') {
    if (channels[intent.channel]!.weaponDefinitionId !== intent.weaponDefinitionId) return world;
    channels[intent.channel] = createArmament(null);
  }
  return parseWorldState({
    ...world,
    entities: world.entities.map(e =>
      e.id === player.id
        ? {
            ...player,
            armament: channels[0],
            inventory: { ...player.inventory, resources },
            equipment: {
              ...equipment,
              revision: equipment.revision + 1,
              ownedWeaponIds: owned,
              technologyWeaponIds: technologies,
              additionalArmaments: channels.slice(1),
            },
          }
        : e
    ),
  });
}
