/** Source-informed immediate phaser damage for the BM1 compatibility module. */
import type { PrimaryHitContext } from '../../src/simulation/contracts/game-rules';
import type { DurabilityComponent } from '../../src/simulation/model/entity-components';

/**
 * `firephaser()` multiplies weapon power by the firing ship size and subtracts
 * it from the target's combined strength. Separate player damage code shows
 * shields absorbing first and negative shield overflow passing into hull. The
 * port keeps those layers explicit while preserving the same total reduction.
 */
export function resolvePrimaryHit(context: PrimaryHitContext): DurabilityComponent {
  const damage = context.weapon.baseDamage * context.attacker.sizeClass;
  const absorbed = Math.min(context.target.condition.shields, damage);
  const overflow = damage - absorbed;
  return Object.freeze({
    shields: context.target.condition.shields - absorbed,
    hull: Math.max(0, context.target.condition.hull - overflow),
  });
}
