/** Shared end-of-tick effect order after each combat path finishes its commit,
 * repair and NPC phase. Projectile impacts must precede specials. */
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
    progression,
  }: Pick<AdvanceWorldInput, 'rules' | 'definitions' | 'systems' | 'combatGeometry' | 'lifecycle' | 'progression'>
): WorldState {
  if (world.status !== 'active') return world;
  const projectiles = advanceProjectiles(world, {
    rules,
    definitions,
    systems,
    combatGeometry,
    lifecycle,
    progression,
  });
  if (projectiles.status !== 'active') return projectiles;
  return advanceSpecialEffects(projectiles, rules, combatGeometry);
}
