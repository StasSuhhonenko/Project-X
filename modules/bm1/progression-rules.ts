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
  const award = weaponAwards.get(event.weaponDefinitionId);
  if (!award) return null;
  const draw = nextRandomInteger(event.randomState, award.extent);
  return {
    delta: { experience: { tactical: (draw.value + award.offset) * 0.01 }, tallies: {} },
    randomState: draw.state,
  };
}
