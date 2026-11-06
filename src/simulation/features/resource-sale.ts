/** Resource exchange is separate from pod cargo: module policy owns thresholds
 * and units; shared settlement prevents underflow, overflow and stale payment. */
import type { GameModule } from '../../content/game-module';
import { ResourceSaleIntentSchema, ResourceSaleQuoteSchema, type ResourceSaleIntent } from '../contracts/cargo-trade';
import { parseWorldState, selectPlayerEntity, type WorldState } from '../model/world-state';

export function quoteResourceSale(world: WorldState, game: GameModule, input: ResourceSaleIntent) {
  const intent = ResourceSaleIntentSchema.safeParse(input),
    player = selectPlayerEntity(world);
  if (!intent.success || world.status !== 'active' || player.condition.repairing || !game.rules.quoteResourceSale)
    return null;
  const system = game.definition.systems.find(system => system.id === player.location.systemId);
  if (!system) return null;
  const result = ResourceSaleQuoteSchema.safeParse(
    game.rules.quoteResourceSale(
      Object.freeze({
        ...intent.data,
        resources: player.inventory.resources,
        system,
        playerPosition: player.location.position,
        cameraZoom: world.cameraZoom,
      })
    )
  );
  if (!result.success) return null;
  const quote = result.data,
    balance = player.inventory.resources[quote.resourceId],
    currency = player.inventory.resources[quote.currencyId];
  if (
    quote.resourceId !== intent.data.resourceId ||
    quote.resourceId === quote.currencyId ||
    balance === undefined ||
    currency === undefined ||
    quote.quantityUnits > balance ||
    !Number.isFinite(currency + quote.amount) ||
    currency + quote.amount > Number.MAX_SAFE_INTEGER
  )
    return null;
  return quote;
}

export function sellResource(world: WorldState, game: GameModule, intent: ResourceSaleIntent): WorldState {
  const quote = quoteResourceSale(world, game, intent);
  if (!quote) return world;
  const sequence = (selectPlayerEntity(world).feedback.notice?.sequence ?? 0) + 1;
  if (quote.feedback && !Number.isSafeInteger(sequence)) return world;
  const player = selectPlayerEntity(world),
    resources = {
      ...player.inventory.resources,
      [quote.resourceId]: player.inventory.resources[quote.resourceId]! - quote.quantityUnits,
      [quote.currencyId]: player.inventory.resources[quote.currencyId]! + quote.amount,
    };
  return parseWorldState({
    ...world,
    entities: world.entities.map(entity =>
      entity.id === player.id
        ? {
            ...player,
            feedback: quote.feedback
              ? { ...player.feedback, notice: { sequence, code: 'resource-sale', message: quote.feedback } }
              : player.feedback,
            inventory: { ...player.inventory, resources },
          }
        : entity
    ),
  });
}
