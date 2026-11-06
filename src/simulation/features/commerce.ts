/** Active-visit market ownership. Generate once at entry, persist realized
 * offers, discard with actors on departure, and never reroll quotes/restores. */
import type { GameModule } from '../../content/game-module';
import { CargoMarketResultSchema, type CargoMarketContext, type CargoMarketResult } from '../contracts/cargo-trade';
import { parseWorldState, selectPlayerEntity, type WorldEntity, type WorldState } from '../model/world-state';

function authoredSupply(game: GameModule, startId: string | null, actor: WorldEntity) {
  const start = game.definition.starts.find(start => start.id === startId);
  if (
    actor.kind !== 'npc-ship' ||
    !start?.npcSpawn ||
    actor.definitionId !== start.npcSpawn.shipDefinitionId ||
    actor.location.systemId !== start.player.systemId
  )
    return null;
  return start.npcSpawn.tradeOffer ?? null;
}
function marketContext(game: GameModule, startId: string | null, actor: WorldEntity, seed: number): CargoMarketContext {
  if (actor.kind !== 'npc-ship' && actor.kind !== 'station') throw Error('A market requires a merchant actor.');
  const system = game.definition.systems.find(system => system.id === actor.location.systemId);
  if (!system) throw Error('Merchant system is unavailable.');
  return Object.freeze({
    kind: actor.kind,
    definitionId: actor.definitionId,
    system,
    seed,
    authoredSupply: authoredSupply(game, startId, actor),
  });
}
function createMarket(game: GameModule, startId: string | null, actor: WorldEntity, seed: number): CargoMarketResult {
  const result = CargoMarketResultSchema.parse(
    game.rules.createCargoMarket!(marketContext(game, startId, actor, seed))
  );
  const terms = [...(result.supply ? [result.supply] : []), ...(result.demand ? [result.demand] : []), ...result.rows];
  if (
    terms.some(
      offer =>
        !game.definition.commerce?.goods.some(goods => goods.id === offer.goodsId && goods.label === offer.label) ||
        !game.definition.resources.some(resource => resource.id === offer.currencyId)
    )
  )
    throw Error('Market contains unknown goods or currency.');
  if (actor.kind === 'station' && (result.rows.length === 0 || result.supply || result.demand))
    throw Error('Station market policy returned ship terms.');
  if (actor.kind === 'npc-ship' && (!result.supply || !result.demand || result.rows.length))
    throw Error('Ship market policy returned station terms.');
  return result;
}
function supportsStationMarket(game: GameModule, actor: WorldEntity): boolean {
  return (
    actor.kind === 'station' &&
    Boolean(
      game.definition.systems
        .find(system => system.id === actor.location.systemId)
        ?.stations.find(station => station.id === actor.stationId)?.commodityMarketSlots?.length
    )
  );
}

export function initializeCommerce(world: WorldState, game: GameModule, startId: string | null): WorldState {
  if (!game.definition.commerce) return world;
  let randomState = world.randomState,
    changed = false;
  // Actor order is the authored construction order, so initialization consumes
  // the deterministic stream sequentially. Quotes never call this operation.
  const entities = world.entities.map(actor => {
    if (actor.kind === 'station' && supportsStationMarket(game, actor) && actor.commodityMarket === null) {
      const seed = randomState,
        result = createMarket(game, startId, actor, seed);
      randomState = result.randomState;
      changed = true;
      return { ...actor, commodityMarket: { seed, rows: result.rows } };
    }
    if (actor.kind === 'npc-ship' && actor.generation === null && actor.tradeSeed === null) {
      const seed = randomState,
        result = createMarket(game, startId, actor, seed);
      randomState = result.randomState;
      changed = true;
      return { ...actor, tradeSeed: seed, tradeOffer: result.supply, tradeDemand: result.demand };
    }
    return actor;
  });
  return changed ? parseWorldState({ ...world, entities, randomState }) : world;
}

/** Validate realized terms against their captured creation seed and immutable
 * authoring context. This proves content consistency, not authenticated history. */
export function validateSavedCommerce(world: WorldState, game: GameModule, startId: string): void {
  const config = game.definition.commerce,
    player = selectPlayerEntity(world);
  if (
    player.inventory.cargo.some(
      pod => !config || pod.slot >= config.slotCapacity || !config.goods.some(goods => goods.id === pod.goodsId)
    )
  )
    throw Error('Saved cargo contains an unavailable position or commodity.');
  world.entities.forEach(actor => {
    if (actor.kind === 'station') {
      const expected = Boolean(config) && supportsStationMarket(game, actor);
      if (!expected) {
        if (actor.commodityMarket !== null) throw Error('Saved station has an undeclared commodity market.');
        return;
      }
      if (!actor.commodityMarket) throw Error('Saved station commodity market is missing.');
      const result = createMarket(game, startId, actor, actor.commodityMarket.seed);
      if (JSON.stringify(result.rows) !== JSON.stringify(actor.commodityMarket.rows))
        throw Error('Saved station commodity prices differ from their creation seed.');
      return;
    }
    if (actor.kind !== 'npc-ship') return;
    if (!config || actor.generation !== null) {
      if (actor.tradeSeed !== null || actor.tradeDemand !== null)
        throw Error('Saved generated actor has an unsupported commerce capability.');
      if (actor.generation !== null && actor.tradeOffer !== null)
        throw Error('Saved generated actor has an unsupported supply offer.');
      return;
    }
    if (actor.tradeSeed === null || !actor.tradeOffer || !actor.tradeDemand)
      throw Error('Saved merchant offer is missing.');
    const expected = createMarket(game, startId, actor, actor.tradeSeed);
    if (
      !expected.supply ||
      actor.tradeOffer.stockTons > expected.supply.stockTons ||
      JSON.stringify({ ...actor.tradeOffer, stockTons: expected.supply.stockTons }) !==
        JSON.stringify(expected.supply) ||
      JSON.stringify(actor.tradeDemand) !== JSON.stringify(expected.demand)
    )
      throw Error('Saved merchant offer differs from its creation identity or stock limit.');
  });
}
