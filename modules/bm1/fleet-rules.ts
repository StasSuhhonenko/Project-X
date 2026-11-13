/** BM1 Fleet purchase/revisit/sale policy. The engine owns authenticated offers,
 * validated prices, payment, IDs, actor construction and atomic publication.
 * Source: Symbol-3-83473.as; Page-1-25841.as:483–512;
 * Symbol-3-104666.as:22–40. No Self trade-in or player refit occurs here. */
import { nextRandomInteger } from '@engine/random/seeded-random';
import type { FleetRules } from '@engine/simulation/contracts/fleet-rules';
import { selectRawShipName, type SourceDraw } from './createship';
import { fleetOrders } from './fleet-order-rules';
import { sourceStageToWorld } from './source-geometry';

/** Both creation paths share exactly four position draws, in source operand
 * order. Stage pixels are converted through the authoritative camera inverse.
 * createalliedship never sets rotation; use the unrotated clip default (0°). */
function placeShip(context: Parameters<FleetRules['placeOwnedShip']>[0], draw: SourceDraw) {
  const x = 298 + draw(200) - draw(200);
  const y = 195 + draw(200) - draw(200);
  return {
    position: sourceStageToWorld({ x, y }, context.playerPosition, context.cameraZoom),
    rotationDegrees: 0,
  };
}

/** One adapter for the existing deterministic world stream; purchasing draws a
 * raw name before placement, while revisiting must never reroll the name. */
function worldDraws(initialState: number) {
  let randomState = initialState;
  return {
    draw: (bound: number) => {
      const step = nextRandomInteger(randomState, bound);
      randomState = step.state;
      return step.value;
    },
    state: () => randomState,
  };
}

export const fleet: FleetRules = Object.freeze<FleetRules>({
  orders: fleetOrders,
  ownedGovernmentId: 16,
  evaluateAcquisition(context) {
    // Null means no installed market adjustment: source priceadjust contributes
    // zero. Unlike Self, Fleet pays the full hull price, with no trade-in.
    const amount =
      context.localGovernmentId === 16
        ? context.vessel.basePrice / 4
        : context.vessel.basePrice + (context.marketAdjustment ?? 0);
    const resourceId = context.localGovernmentId === 16 ? 'deuranium' : 'latinum';
    const price = { resourceId, amount };
    // Source uses the same latinum refusal even for empire deuranium payment.
    if ((context.resources[resourceId] ?? 0) < amount)
      return { price, refusal: 'You do not have enough latinum to buy this ship.' };
    // Original scans systems 1..51. Read current government/population owners;
    // until C14/C15 can change ownership the authored empire population is zero.
    const population = context.empire
      .filter(system => system.systemId >= 1 && system.systemId <= 51 && system.governmentId === 16)
      .reduce((total, system) => total + system.populationBillions, 0);
    if (1 + context.ownedShipCount > 10 + population * 10)
      return { price, refusal: 'You do not have a sufficient population in your empire to staff another ship.' };
    // Size×15 standing is the existing inquiry/preview gate, shared with Self
    // through hasVesselPurchaseStanding; it is not a Fleet release-body check.
    return { price, refusal: null };
  },
  createOwnedShip(context) {
    const stream = worldDraws(context.randomState);
    const name = selectRawShipName(stream.draw);
    const placement = placeShip({ ...context, name }, stream.draw);
    // Source root myrace is ambiguous; the agreed fleet identity uses null.
    return { name, raceId: null, ...placement, randomState: stream.state() };
  },
  placeOwnedShip(context) {
    const stream = worldDraws(context.randomState);
    const placement = placeShip(context, stream.draw);
    return { ...placement, randomState: stream.state() };
  },
  quoteRelease(context) {
    return { resourceId: 'latinum', credit: context.vessel.basePrice, releasedGovernmentId: 12 };
  },
});
