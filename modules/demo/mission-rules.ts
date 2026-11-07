/** Independent survey logistics: fixed linear payment and one helpful survey.
 * Generation deliberately consumes one draw even with fixed authored terms. */
import { nextRandomUnit } from '@engine/random/seeded-random';
import type { MissionRules } from '@engine/simulation/contracts/mission-rules';

export const missions: MissionRules = Object.freeze<MissionRules>({
  paymentResourceId: 'credits',
  createVisitMissions: ({ seed, system, stationIds }) => ({
    planetOffer: {
      goodsId: 'survey-crystals',
      tons: 6,
      destinationSystemId: system.id === 3 ? 4 : 3,
      basePayPerTon: 3,
      hazardPayPerTon: 0,
      negotiated: false,
    },
    stationOffers: Object.fromEntries(stationIds.map(id => [id, null])),
    surfaceMissionIndex: system.id === 3 ? 1 : 0,
    randomState: nextRandomUnit(seed).state,
  }),
  resolveContractNegotiation: ({ offer, randomState }) => ({
    success: true,
    basePayPerTon: offer.basePayPerTon + 1,
    randomState: nextRandomUnit(randomState).state,
  }),
  quoteContractAcceptance: ({ offer, freeCapacity }) =>
    freeCapacity < 1
      ? { refusal: 'Make room for the survey shipment.' }
      : {
          tons: Math.min(offer.tons, freeCapacity),
          payout: Math.floor(Math.min(offer.tons, freeCapacity) * offer.basePayPerTon),
        },
  resolveSurfaceMission: ({ missionIndex }) => ({
    message: missionIndex === 0 ? 'The survey team takes a quiet walk.' : 'Your team repairs a local weather sensor.',
    standingDelta: missionIndex === 0 ? 0 : 1,
  }),
  canReachSurface: ({ playerPosition, planetPosition }) =>
    Math.hypot(playerPosition.x - planetPosition.x, playerPosition.y - planetPosition.y) <= 500,
  describeContractDelivery: ({ payout }) => `Survey shipment delivered for ${payout} credits.`,
});
