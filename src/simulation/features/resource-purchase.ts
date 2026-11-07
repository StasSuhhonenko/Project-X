/** Validate a module quote against live balances, then publish payment, gain and
 * HUD feedback together. Contact descriptions remain transient UI feedback. */
import type { GameModule } from '../../content/game-module';
import {
  ResourcePurchaseIntentSchema,
  ResourcePurchaseResultSchema,
  type ResourcePurchaseIntent,
} from '../contracts/resource-purchase';
import { parseWorldState, selectPlayerEntity, type WorldState } from '../model/world-state';

export function purchaseResource(world: WorldState, game: GameModule, input: ResourcePurchaseIntent) {
  const unchanged = { world, result: null };
  const intent = ResourcePurchaseIntentSchema.safeParse(input);
  const player = selectPlayerEntity(world);
  if (!intent.success || world.status !== 'active' || player.condition.repairing || !game.rules.quoteResourcePurchase)
    return unchanged;
  const system = game.definition.systems.find(system => system.id === player.location.systemId);
  const vessel = game.catalog.getShipDefinition(player.definitionId);
  if (!system || !vessel) return unchanged;
  const parsed = ResourcePurchaseResultSchema.safeParse(
    game.rules.quoteResourcePurchase(
      Object.freeze({
        ...intent.data,
        resources: player.inventory.resources,
        system,
        vessel,
        playerPosition: player.location.position,
        cameraZoom: world.cameraZoom,
      })
    )
  );
  if (!parsed.success) return unchanged;
  const result = parsed.data;
  const balance = player.inventory.resources[result.resourceId];
  const currency = player.inventory.resources[result.currencyId];
  const sequence = (player.feedback.notice?.sequence ?? 0) + 1;
  if (
    result.resourceId !== intent.data.resourceId ||
    result.resourceId === result.currencyId ||
    balance === undefined ||
    currency === undefined ||
    result.amount > currency ||
    balance + result.quantityUnits > Number.MAX_SAFE_INTEGER ||
    (result.quantityUnits === 0) !== (result.amount === 0) ||
    (result.notice && !Number.isSafeInteger(sequence))
  )
    return unchanged;
  if (result.quantityUnits === 0 && !result.notice) return { world, result };
  return {
    result,
    world: parseWorldState({
      ...world,
      entities: world.entities.map(entity =>
        entity.id !== player.id
          ? entity
          : {
              ...player,
              inventory: {
                ...player.inventory,
                resources: {
                  ...player.inventory.resources,
                  [result.resourceId]: balance + result.quantityUnits,
                  [result.currencyId]: currency - result.amount,
                },
              },
              feedback: result.notice
                ? { ...player.feedback, notice: { sequence, code: 'resource-purchase', message: result.notice } }
                : player.feedback,
            }
      ),
    }),
  };
}
