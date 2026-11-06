/** Shared end-of-tick effect order after each combat path finishes its commit,
 * lifecycle settlement and repair. Projectile impacts must precede specials. */
import type { WorldState } from '../model/world-state';
import type { AdvanceWorldInput } from './advance-world';
import { advanceProjectiles } from './projectiles';
import { advanceSpecialEffects } from './special-weapons';

export function advanceCombatEffects(
  world: WorldState,
  {
    rules,
    definitions,
    systems = [],
    combatGeometry,
    lifecycle,
  }: Pick<AdvanceWorldInput, 'rules' | 'definitions' | 'systems' | 'combatGeometry' | 'lifecycle'>
): WorldState {
  return advanceSpecialEffects(
    advanceProjectiles(world, { rules, definitions, systems, combatGeometry, lifecycle }),
    rules,
    combatGeometry
  );
}
