/** Page1:274 overwrites the authored sun matrix on each load. There is no
 * source table of per-system positions. This seed belongs to presentation,
 * never to authoritative world/save randomness. */
import { z } from 'zod';
import { nextRandomInteger } from '../../../../src/random/seeded-random';
import raw from '../sky-data.json';

const rule = z.object({ randomExclusiveMaximum:z.literal(300),center:z.literal(300) }).strict().readonly().parse(raw.sun);

/** Exactly four ordered draws: random(300)-random(300)+300 per axis.
 * Range is 1..599 on BOTH axes; an offscreen sun is legitimate source behavior. */
export function createSunPlacement(presentationSeed:number) {
  let seed = presentationSeed;
  const draws = Array.from({length:4}, () => {
    const next = nextRandomInteger(seed, rule.randomExclusiveMaximum);
    seed = next.state;
    return next.value;
  });
  return Object.freeze({x:draws[0]! - draws[1]! + rule.center,y:draws[2]! - draws[3]! + rule.center});
}
