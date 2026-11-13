/** Independent survey boarding: a circular rendezvous with a badly damaged
 * vessel recovers a small credit cache. No fleet/capture capability is needed. */
import { nextRandomInteger } from '@engine/random/seeded-random';
import type { BoardingRules } from '@engine/simulation/contracts/boarding-rules';

export const boarding: BoardingRules = {
  beamOverMessage: 'Survey team crossing to the contact.',
  assessBoarding: context => {
    const distance = Math.hypot(
      context.playerPosition.x - context.targetPosition.x,
      context.playerPosition.y - context.targetPosition.y
    );
    return {
      inBeamRange: distance <= 40,
      eligible:
        distance <= 25 &&
        context.targetMaximumStrength > 0 &&
        context.targetStrength / context.targetMaximumStrength < 0.1,
    };
  },
  resolveBoarding: context => {
    const draw = nextRandomInteger(context.randomState, 4);
    return {
      randomState: draw.state,
      standingDelta: 0,
      message: 'Survey cache recovered; contact retired.',
      outcome: { kind: 'pillage', resourceId: 'credits', amount: 3 + draw.value },
      selfDestruct: true,
    };
  },
};
