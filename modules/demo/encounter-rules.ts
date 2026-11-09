/** Independently authored survey traffic: one or two visitors, alternating
 * cooperative/settlement allegiance. Two draws per ship place it in world
 * units around the planet; the first visitor targets actor slot 1 (the first station) when present. */
import { nextRandomInteger } from '@engine/random/seeded-random';
import type {
  EncounterShipSpec,
  VisitEncounterContext,
  VisitEncounterResult,
} from '@engine/simulation/contracts/encounter-rules';

export function createVisitEncounter(context: VisitEncounterContext): VisitEncounterResult {
  const count = nextRandomInteger(context.randomState, 2);
  let randomState = count.state;
  const ships: EncounterShipSpec[] = Array.from({ length: count.value + 1 }, (_, index) => {
    const horizontal = nextRandomInteger(randomState, 401);
    const vertical = nextRandomInteger(horizontal.state, 401);
    randomState = vertical.state;
    return {
      definitionId: 1,
      governmentId: index + 1,
      name: index === 0 ? 'Survey Kite' : 'Settlement Finch',
      rotationDegrees: 0,
      position: {
        x: context.system.planet.placement.position.x + horizontal.value - 200,
        y: context.system.planet.placement.position.y + vertical.value - 200,
      },
      // Slot 0 is always empty; slot 1 is the first station when one exists.
      initialTarget: index === 0 && context.actorSlotCount > 1 ? { kind: 'actor-slot', slot: 1 } : { kind: 'planet' },
    };
  });
  return { ships, randomState };
}
