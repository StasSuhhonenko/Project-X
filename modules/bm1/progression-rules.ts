/** Captain awards recovered from Page-1-25841.as. The engine owns accepted
 * host timing; refused C4 shots deliberately earn nothing (C7 adaptation).
 * Values are plain source sums: never round accumulated experience. */
import { nextRandomInteger } from '@engine/random/seeded-random';
import type { ProgressionEvent, ProgressionResult } from '@engine/simulation/contracts/progression-rules';

/** Single weapon-ID/formula join: :242 phasers, :261 disruptors, :278
 * torpedoes (26 dispatches at :752–758), :801 tractor. Other IDs draw nothing. */
const weaponAwards = new Map(
  [
    { ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], extent: 2, offset: 1 },
    { ids: [11, 12, 13, 14, 15, 16, 17, 18, 19, 26], extent: 2, offset: 0 },
    { ids: [25], extent: 5, offset: 1 },
  ].flatMap(award => award.ids.map(id => [id, award] as const))
);

export function resolveProgression(event: ProgressionEvent): ProgressionResult | null {
  // Page1:25841:656 rep[3]; every eligible attempt, including failed capture.
  // This award draws nothing and must not advance the captain stream.
  if (event.kind === 'ship-boarded')
    return { delta: { experience: {}, tallies: { pirate: 1 } }, randomState: event.randomState };
  // C8: Symbol3:40563/10214 and Page1:25841:846,870–871. Experience
  // uses the separate captain stream; acceptance never consumes a draw.
  if (event.kind === 'contract-accept') {
    if (event.offerKind !== 'planet') return null;
    return { delta: { experience: {}, tallies: { trader: 1 } }, randomState: event.randomState };
  }
  if (event.kind === 'contract-negotiate') {
    const draw = nextRandomInteger(event.randomState, 2);
    return {
      delta: { experience: { negotiation: (draw.value + 1) * 0.1 }, tallies: { merchant: 1 } },
      randomState: draw.state,
    };
  }
  if (event.kind === 'contract-delivery' || event.kind === 'surface-mission') {
    if (event.kind === 'surface-mission' && event.standingDelta === 0) return null;
    const draw = nextRandomInteger(event.randomState, 2);
    const skill = event.kind === 'contract-delivery' ? 'trade' : 'away-team';
    return { delta: { experience: { [skill]: (draw.value + 1) * 0.5 }, tallies: {} }, randomState: draw.state };
  }
  if (event.kind === 'travel-departure') {
    // :535–536, navigation draw before the non-random Explorer award.
    const draw = nextRandomInteger(event.randomState, 2);
    return {
      delta: { experience: { navigation: (draw.value + 1) * 0.1 }, tallies: { explorer: 0.5 } },
      randomState: draw.state,
    };
  }
  if (event.kind === 'repair-start') {
    // :207, once per accepted paid repair start.
    const draw = nextRandomInteger(event.randomState, 2);
    return { delta: { experience: { engineering: (draw.value + 1) * 0.5 }, tallies: {} }, randomState: draw.state };
  }
  if (event.kind !== 'weapon-fire') return null;
  const award = weaponAwards.get(event.weaponDefinitionId);
  if (!award) return null;
  const draw = nextRandomInteger(event.randomState, award.extent);
  return {
    delta: { experience: { tactical: (draw.value + award.offset) * 0.01 }, tallies: {} },
    randomState: draw.state,
  };
}
