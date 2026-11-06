/** Copied immutable equipment/offer read model. Quotes and intents carry no
 * world aliases; every action is revalidated against the current store state. */
import { z } from 'zod';
import type { AppStoreState } from '../app/app-store';
import type { GameModule } from '../content/game-module';
import {
  assessEquipment,
  EquipmentAssessmentSchema,
  EquipmentIntentSchema,
  quoteEquipment,
} from '../simulation/features/equipment';
import { equipmentArmaments } from '../simulation/model/equipment-state';
import { selectPlayerEntity } from '../simulation/model/world-state';

const Item = z
  .object({
    inventoryIndex: z.number().int(),
    weaponDefinitionId: z.number().int().positive().nullable(),
    loadIntents: z.array(EquipmentIntentSchema).length(3).readonly(),
    sellIntent: EquipmentIntentSchema.nullable(),
    sellAmount: z.number().finite().nonnegative().nullable(),
  })
  .strict()
  .readonly();
export const EquipmentViewSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    systemId: z.number().int().positive(),
    marketAdjustment: z.number().finite(),
    owned: z.array(Item).readonly(),
    technologyWeaponIds: z.array(z.number().int().positive()).readonly(),
    channels: z
      .array(
        z
          .object({
            weaponDefinitionId: z.number().int().positive().nullable(),
            cooldownRemainingFrames: z.number().finite().nonnegative(),
            hasFired: z.boolean(),
            unequipIntent: EquipmentIntentSchema,
          })
          .strict()
          .readonly()
      )
      .length(3)
      .readonly(),
    stationEntityId: z.string().nullable(),
    offers: z
      .array(
        z
          .object({
            weaponDefinitionId: z.number().int().positive().nullable(),
            refusal: EquipmentAssessmentSchema.unwrap().shape.refusal,
            price: z.number().finite().nonnegative().nullable(),
            resourceId: z.string().nullable(),
            intent: EquipmentIntentSchema.nullable(),
          })
          .strict()
          .readonly()
      )
      .max(6)
      .readonly(),
  })
  .strict()
  .readonly();
export type EquipmentView = z.infer<typeof EquipmentViewSchema>;
export function selectEquipmentView(state: AppStoreState, game: GameModule): EquipmentView | null {
  if (!state.world || state.world.status !== 'active') return null;
  const world = state.world,
    player = selectPlayerEntity(world),
    equipment = player.equipment;
  if (!equipment) return null;
  const context = {
    sessionRevision: state.sessionRevision,
    revision: equipment.revision,
    systemId: player.location.systemId,
    playerDefinitionId: player.definitionId,
    stationEntityId: world.selectedTargetEntityId,
  };
  const intent = (
    operation: 'load' | 'purchase' | 'sell' | 'unequip',
    weaponDefinitionId: number | null,
    inventoryIndex = 0,
    channel: 0 | 1 | 2 = 0
  ) => EquipmentIntentSchema.parse({ ...context, operation, weaponDefinitionId, inventoryIndex, channel });
  const station = world.entities.find(e => e.id === world.selectedTargetEntityId && e.kind === 'station');
  const offers =
    station?.kind === 'station'
      ? (game.definition.systems
          .find(s => s.id === player.location.systemId)!
          .stations.find(s => s.id === station.stationId)?.equipmentOffers ?? [])
      : [];
  return EquipmentViewSchema.parse({
    revision: equipment.revision,
    systemId: player.location.systemId,
    marketAdjustment: equipment.marketAdjustment,
    technologyWeaponIds: [...equipment.technologyWeaponIds],
    stationEntityId: station?.id ?? null,
    owned: equipment.ownedWeaponIds.map((id, inventoryIndex) => {
      const quote = id === null ? null : quoteEquipment(world, game, id, 'sell');
      return {
        inventoryIndex,
        weaponDefinitionId: id,
        loadIntents: ([0, 1, 2] as const).map(channel => intent('load', id, inventoryIndex, channel)),
        sellIntent: quote ? intent('sell', id, inventoryIndex) : null,
        sellAmount: quote?.amount ?? null,
      };
    }),
    channels: equipmentArmaments(player).map((a, i) => ({
      weaponDefinitionId: a.weaponDefinitionId,
      cooldownRemainingFrames: a.cooldownRemainingFrames,
      hasFired: a.lastAcceptedShot !== null,
      unequipIntent: intent('unequip', a.weaponDefinitionId, 0, i as 0 | 1 | 2),
    })),
    offers: offers.map(id => {
      const assessment = id === null ? null : assessEquipment(world, game, id, 'purchase');
      const quote = assessment?.price ?? null;
      return {
        weaponDefinitionId: id,
        refusal: assessment?.refusal ?? null,
        price: quote?.amount ?? null,
        resourceId: quote?.resourceId ?? null,
        intent: quote && assessment?.refusal === null ? intent('purchase', id) : null,
      };
    }),
  });
}
