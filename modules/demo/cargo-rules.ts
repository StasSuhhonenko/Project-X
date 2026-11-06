/** Independently authored three-position hold and linear exchange. */
import { nextRandomInteger } from '@engine/random/seeded-random';
import type {
  CargoMarketContext,
  CargoMarketResult,
  ResourceSaleContext,
  ResourceSaleQuote,
} from '@engine/simulation/contracts/cargo-trade';

export { planLinearCargoTransfer as planCargoTransfer } from '@engine/simulation/model/cargo-allocation';

export function createCargoMarket(context: CargoMarketContext): CargoMarketResult {
  const step = nextRandomInteger(context.seed, 5);
  if (context.kind === 'station')
    return {
      supply: null,
      demand: null,
      randomState: step.state,
      rows: [
        {
          goodsId: 'survey-crystals',
          label: 'Survey Crystals',
          currencyId: 'credits',
          pricePerTon: 9 + step.value,
        },
        { goodsId: 'copper-filament', label: 'Copper Filament', currencyId: 'credits', pricePerTon: 4 },
      ],
    };
  return {
    supply: context.authoredSupply ?? {
      goodsId: 'survey-crystals',
      label: 'Survey Crystals',
      currencyId: 'credits',
      pricePerTon: 12,
      stockTons: 5,
    },
    demand: {
      goodsId: 'survey-crystals',
      label: 'Survey Crystals',
      currencyId: 'credits',
      pricePerTon: 7,
      advertisedTons: 3,
    },
    rows: [],
    randomState: step.state,
  };
}
export function quoteResourceSale({
  resourceId,
  resources,
  system,
  all,
}: ResourceSaleContext): ResourceSaleQuote | null {
  if (resourceId !== 'fuel' || system.initialPopulationBillions <= 0 || (resources.fuel ?? 0) < 2) return null;
  const quantityUnits = all ? resources.fuel! : 1;
  return { resourceId, currencyId: 'credits', quantityUnits, amount: quantityUnits * 4 };
}
