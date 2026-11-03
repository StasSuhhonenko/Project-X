/** Page 1:25841 loadplayer()/Symbol 2:6202 share the same energy capacity:
 * five energy units per ton of validated vessel cargo capacity. Presentation
 * and movement consume this one rule; neither owns another energy maximum. */
export function energyCapacity(cargoCapacity: number): number {
  return cargoCapacity * 5;
}
