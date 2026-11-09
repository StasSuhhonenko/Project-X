/** C10a visit encounter: the ordinary-ship part of source `setstations()`
 * (Page-1-25841.as:356–378) and `createship()` (:388–481), drawn from the world
 * stream in source order. Shared draws (roster, name, position, target) come from
 * `createship.ts`, which C2 generated defenders also use. Allied fleet ships
 * (:379–386, government 16) belong to C11. */
import { nextRandomInteger } from '@engine/random/seeded-random';
import type {
  EncounterShipSpec,
  VisitEncounterContext,
  VisitEncounterResult,
} from '@engine/simulation/contracts/encounter-rules';
import {
  drawInitialTargetSlot,
  drawStagePosition,
  isSpawnableShip,
  selectRosterShip,
  selectShipName,
  type RosterShip,
  type SourceDraw,
} from './createship';
import { sourceStageToWorld } from './source-geometry';

/** Source government IDs used by createship. */
const INDEPENDENT = 12;
const PIRATES = 15;
const PLAYER = 16;
/** Source `newtype` and `random(5)` gates for one spawn opportunity / enemy fleet. */
const NEWTYPE_EXTENT = 20;
const SPAWN_CAP = 20;

type ShipRequest = 'ordinary' | 'enemy';

/** Engine capability: the source spawn plan drawn from the world stream. */
export function createVisitEncounter(context: VisitEncounterContext): VisitEncounterResult {
  let randomState = context.randomState;
  const draw: SourceDraw = bound => {
    const result = nextRandomInteger(randomState, bound);
    randomState = result.state;
    return result.value;
  };
  const ships = planVisitEncounter(context, draw);
  return { ships, randomState };
}

/** The source spawn plan for one system entry, drawing through `draw` in exact
 * source order. Separated from the stream so tests can script each draw. */
export function planVisitEncounter(context: VisitEncounterContext, draw: SourceDraw): EncounterShipSpec[] {
  // Absent source governments are 0 (planetGovts entries default to 0).
  const local = context.system.governmentId ?? 0;
  const opposing = context.system.opposingGovernmentId ?? 0;
  // The runtime has no mutable population yet: the spawn count (planetPops) and
  // the pirate overwrite (authored planetArray[5]) read the same authored value.
  const population = context.population;
  const ships: EncounterShipSpec[] = [];
  // Source settype/setrace are globals: newtype 7–9 in a populated system assigns
  // neither and reuses the previous createship's values (see `createShip`).
  let previous: RosterShip | null = null;

  /** One createship() call. Every source draw is consumed even when no actor
   * can be created, so later draws never shift. */
  const createShip = (request: ShipRequest) => {
    let ship: RosterShip | null = previous;
    let government = INDEPENDENT;
    if (request === 'enemy') {
      ship = selectRosterShip(opposing, draw);
      government = opposing;
    }
    if (request === 'ordinary') {
      const newtype = draw(NEWTYPE_EXTENT);
      if (newtype <= 3) ship = { definitionId: draw(14) + 1, raceId: 1 };
      if (newtype === 4) {
        ship = selectRosterShip(opposing, draw);
        government = opposing;
      }
      if (newtype >= 10) {
        ship = selectRosterShip(local, draw);
        government = local === PLAYER ? INDEPENDENT : local;
      }
      // Trader override, then its literal `else if`: `(newtype>=7 or newtype<=9)`
      // is true for every newtype, so in low-population systems every non-trader
      // result becomes a pirate. Kept literal, not corrected to `and`.
      const trader = newtype === 5 || newtype === 6 || local === PLAYER;
      if (trader) {
        ship = { definitionId: draw(15) + 1, raceId: 1 };
        government = INDEPENDENT;
      }
      if (!trader && context.system.initialPopulationBillions < 2) {
        ship = { definitionId: draw(15) + 1, raceId: 8 };
        government = PIRATES;
      }
    }
    if (government === 0) government = INDEPENDENT;
    previous = ship;
    // Name (race prefix), position and target are drawn whether or not an actor results.
    const name = selectShipName(ship?.raceId ?? 1, draw);
    const stage = drawStagePosition(draw);
    const slot = drawInitialTargetSlot(draw, context.actorSlotCount);
    // C10a adaptations: no previous type in this visit (source: an undefined clip)
    // or a type without recovered artwork (ship 23) creates no actor.
    if (!ship || !isSpawnableShip(ship.definitionId)) return;
    ships.push({
      definitionId: ship.definitionId,
      governmentId: government,
      name,
      raceId: ship.raceId,
      position: sourceStageToWorld(stage, context.playerPosition, context.cameraZoom),
      rotationDegrees: 0,
      initialTarget: slot === null ? { kind: 'planet' } : { kind: 'actor-slot', slot },
    });
  };

  // `while (i < x)` with x = min(planetPops*2+1, 20): ceil for fractional x, none when x <= 0.
  const opportunities = Math.max(0, Math.ceil(Math.min(population * 2 + 1, SPAWN_CAP)));
  Array.from({ length: opportunities }).forEach(() => {
    if (draw(2) === 1) createShip('ordinary');
  });
  // `random(5)` is drawn before the population/opposing conjuncts.
  if (draw(5) === 1 && population > 0 && opposing !== 0) {
    const fleet = draw(10) + 1;
    Array.from({ length: fleet }).forEach(() => createShip('enemy'));
  }
  return ships;
}
