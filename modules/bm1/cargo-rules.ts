/** Source Symbol12:155 offer draw order and Symbol3 cargo arithmetic. Recovery
 * code is never imported: this policy consumes only maintained validated goods. */
import { nextRandomInteger } from '@engine/random/seeded-random';
import {
  CommerceDefinitionSchema,
  type CargoMarketContext,
  type CargoMarketResult,
  type CargoTransferContext,
  type CargoTransferPlan,
  type ResourceSaleContext,
  type ResourceSaleQuote,
} from '@engine/simulation/contracts/cargo-trade';
import { allocateCargoPositions } from '@engine/simulation/model/cargo-allocation';
import raw from './commodity-data.json';
import { worldToSourceStage } from './source-geometry';

const commerce = CommerceDefinitionSchema.parse(raw);

export function createCargoMarket(context: CargoMarketContext): CargoMarketResult {
  let randomState = context.seed;
  const draw = (max: number) => {
    const next = nextRandomInteger(randomState, max);
    randomState = next.state;
    return next.value;
  };
  const goods = () => commerce.goods[draw(42)]!;
  draw(73); // Source greeting draw precedes both ship and station commerce.
  if (context.kind === 'npc-ship') {
    const wanted = goods(),
      advertisedTons = draw(50) + 2,
      demandPrice = draw(20) + 1;
    const supplied = goods(),
      stockTons = draw(50) + 2,
      supplyPrice = draw(3) + 1;
    return {
      supply: context.authoredSupply ?? {
        goodsId: supplied.id,
        label: supplied.label,
        stockTons,
        pricePerTon: supplyPrice,
        currencyId: 'latinum',
      },
      demand: {
        goodsId: wanted.id,
        label: wanted.label,
        advertisedTons,
        pricePerTon: demandPrice,
        currencyId: 'latinum',
      },
      rows: [],
      randomState,
    };
  }
  // Source creates the station mission offer before the merchant rows. Consume
  // its known draws without inventing C8 mission state or executing its rules.
  draw(100);
  goods();
  draw(50);
  draw(200);
  const rows = Array.from({ length: 8 }, () => {
    const pricePerTon = draw(10) + 1,
      item = goods();
    return { goodsId: item.id, label: item.label, pricePerTon, currencyId: 'latinum' };
  });
  return { supply: null, demand: null, rows, randomState };
}

export function planCargoTransfer(context: CargoTransferContext): CargoTransferPlan | null {
  const positions = allocateCargoPositions(context, {
    everyMatchingPosition: true,
    drainSale: context.side === 'sell' && context.kind === 'npc-ship',
  });
  if (!positions) return null;
  const shipSale = context.side === 'sell' && context.kind === 'npc-ship';
  const units = positions.reduce((sum, pod) => sum + (shipSale ? (pod.tons * (pod.tons + 1)) / 2 : pod.tons), 0);
  const last = positions[positions.length - 1]!;
  const prior = context.cargo.find(pod => pod.slot === last.slot);
  const feedback =
    context.side === 'buy'
      ? context.kind === 'npc-ship'
        ? 'Cargo transfer complete...'
        : prior
          ? 'You place 1 additional ton of this item in your cargo hold.'
          : 'You place 1 ton of a new item in a cargo pod.'
      : shipSale
        ? `You sell ${last.tons} tons of your ${context.terms.label}`
        : prior?.tons === 1
          ? 'You sell your last ton of this item.'
          : 'You have sold 1 ton of this item.';
  return { positions, amount: units * context.terms.pricePerTon, feedback };
}

/** Symbol3:104666. Quantity/Shift contradictions are original behavior. */
export function quoteResourceSale(context: ResourceSaleContext): ResourceSaleQuote | null {
  const { resourceId, resources, system, all } = context;
  const point = worldToSourceStage(system.planet.placement.position, context.playerPosition, context.cameraZoom);
  if (system.initialPopulationBillions <= 0 || point.x < -50 || point.x > 700 || point.y < -50 || point.y > 450)
    return null;
  const units = resources[resourceId] ?? 0;
  if (resourceId === 'antimatter' && units > 5)
    return {
      resourceId,
      currencyId: 'latinum',
      quantityUnits: 5,
      amount: 5,
      feedback: 'You sell 5 units of antimatter...',
    };
  if (resourceId === 'deuranium' && units >= 10)
    return {
      resourceId,
      currencyId: 'latinum',
      quantityUnits: all ? units : 1,
      amount: all ? units : 1,
      feedback: all ? `You sell ${units} tons of deuranium...` : 'You sell 1 ton of deuranium...',
    };
  return null;
}
