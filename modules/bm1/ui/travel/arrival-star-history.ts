/** Page1 frame2 star handlers: independent horizontal drift and ordered random
 * edge respawns. View-owned randomness never advances simulation RNG or saves. */
import { nextRandomUnit } from '../../../../src/random/seeded-random';
import { viewportContent } from '../viewport/viewport-content';

/** One operation-local history. Sampling rate cannot affect respawns; callers
 * supply visible elapsed time, resetting only on a new arrival attachment. */
export function createArrivalStarHistory() {
  const initial = viewportContent.arrivalStars.map(star => ({x:star.x,y:star.y,respawned:false}));
  let previous = initial, current = initial, step = -1, seed = 271828;
  return Object.freeze({
    sample(elapsedMs: number) {
      if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw Error('Invalid arrival star time.');
      const position = elapsedMs * 13 / 1000;
      if (Math.floor(position) < step) { previous = initial; current = initial; step = -1; seed = 271828; }
      // Handler order determines random draws. No array reordering or skipped
      // simulation/gameplay steps are involved in these presentation updates.
      while (step < Math.floor(position)) {
        previous = current;
        current = current.map((prior,index) => {
          const authored = viewportContent.arrivalStars[index]!;
          const x = prior.x + authored.speedPerFrame;
          // Page1:17001 tests locx instead of _x; preserve its non-wrapping
          // behavior for the supported (<600-pixel) inherited flight delta.
          if (x <= 600 || !authored.wrap) return {x,y:prior.y,respawned:false};
          const random = nextRandomUnit(seed); seed = random.state;
          return {x:0,y:Math.floor(random.value * 450),respawned:true};
        });
        step += 1;
      }
      return Object.freeze(current.map((star,index) => Object.freeze(star.respawned ? star : {
        ...star,x:previous[index]!.x + (star.x - previous[index]!.x) * (position - Math.floor(position)),
      })));
    },
  });
}
