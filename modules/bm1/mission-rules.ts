/** Ordinary C8 source policy. Page1:18556 planet load; Symbol12:155 station
 * load; Symbol3:40563/11118 acceptance,10214 negotiation; Page1:25841 transport.
 * C5 owns priceadjust draws; C6 owns greeting/offer/rows for market stations.
 * Captured commerce seeds replay those offers without advancing the live stream.
 * Cross-clip ordering is adapted to host initialization (see C8 plan Results). */
import { nextRandomInteger } from '@engine/random/seeded-random';
import { CommerceDefinitionSchema } from '@engine/simulation/contracts/cargo-trade';
import type { MissionRules } from '@engine/simulation/contracts/mission-rules';
import type { ContractOffer } from '@engine/simulation/model/mission-state';
import goodsData from './commodity-data.json';
import { missionData } from './mission-data';
import { surfaceOverlap } from './planet-overlap';
import { drawStationContract } from './station-contract';

const commerce = CommerceDefinitionSchema.parse(goodsData);
/** Null is an explicit unavailable maintained destination, never a reroll. */
function offer(
  tons: number,
  goodsIndex: number,
  destination: number,
  basePayPerTon: number,
  hazardPayPerTon = 0
): ContractOffer | null {
  const systemId = missionData.destinations.find(row => row.sourceIndex === destination)?.systemId;
  if (!systemId) return null;
  return {
    tons,
    goodsId: commerce.goods[goodsIndex]!.id,
    destinationSystemId: systemId,
    basePayPerTon,
    hazardPayPerTon,
    negotiated: false,
  };
}
export const missions: MissionRules = Object.freeze<MissionRules>({
  paymentResourceId: 'latinum',
  createVisitMissions: ({ seed, standing, stationIds, stationMarketSeeds = {} }) => {
    let randomState = seed;
    const draw = (extent: number) => {
      const next = nextRandomInteger(randomState, extent);
      randomState = next.state;
      return next.value;
    };
    const tons = draw(500) + 20,
      goods = draw(42),
      destination = draw(50) + 1;
    const base = (draw(100) + 20) * 0.2;
    const hazard = (standing.find(row => row.systemId === destination)?.value ?? 0) < 0 ? draw(10) + 1 : 0;
    // C5 consumed all three priceadjust draws before commerce. Repeating them
    // here would debit the same source operation twice. AT remains last for planet.
    const surfaceMissionIndex = draw(31) + 1;
    const stationOffers = Object.fromEntries(
      stationIds.map(id => {
        const marketSeed = stationMarketSeeds[id];
        if (marketSeed !== undefined) {
          let replayState = marketSeed;
          const replay = (extent: number) => {
            const next = nextRandomInteger(replayState, extent);
            replayState = next.state;
            return next.value;
          };
          replay(73);
          const terms = drawStationContract(replay);
          return [id, offer(terms.tons, terms.goodsIndex, terms.destinationSystemId, terms.basePayPerTon)];
        }
        draw(73);
        const terms = drawStationContract(draw);
        // Non-market station actors still execute all eight source price/goods
        // pairs on clip load. They expose no merchant rows, but consume the draws.
        Array.from({ length: 8 }).forEach(() => {
          draw(10);
          draw(42);
        });
        return [id, offer(terms.tons, terms.goodsIndex, terms.destinationSystemId, terms.basePayPerTon)];
      })
    );
    return {
      planetOffer: offer(tons, goods, destination, base, hazard),
      stationOffers,
      surfaceMissionIndex,
      randomState,
    };
  },
  quoteContractAcceptance: ({ offer, kind, freeCapacity }) => {
    if (freeCapacity < 1) return { refusal: 'You have no cargo room to accept. Dump some cargo.' };
    const tons = Math.min(offer.tons, freeCapacity);
    return { tons, payout: Math.floor((offer.basePayPerTon + (kind === 'planet' ? offer.hazardPayPerTon : 0)) * tons) };
  },
  resolveContractNegotiation: ({ offer, progression, randomState }) => {
    const neg = Math.min(Math.floor(progression?.experience.negotiation ?? 0), 1);
    const chance = nextRandomInteger(randomState, 10 - neg);
    if (chance.value !== 1) return { success: false, basePayPerTon: offer.basePayPerTon, randomState: chance.state };
    const increase = nextRandomInteger(chance.state, 20);
    return { success: true, basePayPerTon: offer.basePayPerTon + increase.value + 1, randomState: increase.state };
  },
  resolveSurfaceMission: ({ missionIndex }) => {
    const row = missionData.missions[missionIndex] ?? missionData.missions[0]!;
    return { message: `    ${row.text} Prestige adjusts ${row.standingDelta}%.`, standingDelta: row.standingDelta };
  },
  describeContractDelivery: ({ population, payout, tons, goodsLabel }) =>
    `    You transport ${tons} tons of ${goodsLabel} to ${population < 0 ? 'a transport container in orbit of the planet' : 'the surface'}. ${payout} bars of latinum are beamed to your ship.`,
  canReachSurface: ({
    system,
    playerDefinitionId,
    playerPosition,
    planetPosition,
    cameraZoom,
    playerHeadingDegrees = 0,
  }) => surfaceOverlap(system, playerDefinitionId, playerPosition, planetPosition, cameraZoom, playerHeadingDegrees),
});
