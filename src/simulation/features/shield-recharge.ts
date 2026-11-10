/**
 * Game-neutral orchestration for optional passive player shield recharge.
 *
 * The module policy owns the arithmetic (rate, eligibility, clamping). This
 * feature owns the engine invariants and the tick position: it is evaluated
 * once per tick against the tick-entry player state, and its answer is handed
 * to `commitWorldTick` so the increment lands atomically with movement and
 * firing. Later phases of the same tick (repair, NPC fire, effects) therefore
 * act on the recharged value, matching a source frame that settles recharge
 * before reading navigation keys and before incoming damage.
 */
import type { ShipDefinition } from '../../content/schemas/game-content';
import type { GameRules } from '../contracts/game-rules';
import type { ShieldRechargeContext } from '../contracts/shield-recharge-rules';
import { selectPlayerEntity, type WorldState } from '../model/world-state';

/**
 * Return the recharged shield value for this tick, or `undefined` when the
 * module has no recharge capability or its answer leaves shields unchanged.
 * Throws when the policy answer would damage the player or exceed the vessel
 * maximum; callers treat that as a failed tick with no partial commit.
 *
 * This runs every tick, so it avoids a schema parse: the context is built
 * from already validated world state and content, and the single numeric
 * answer is checked directly (finite, monotonic, bounded). The Zod schemas in
 * `shield-recharge-rules.ts` remain the documented contract for these values.
 */
export function resolvePlayerShieldRecharge(
  world: WorldState,
  vessel: Pick<ShipDefinition, 'maximumShields'>,
  rules: Pick<GameRules, 'rechargePlayerShields'>
): number | undefined {
  if (!rules.rechargePlayerShields) return undefined;
  const player = selectPlayerEntity(world);
  const context: ShieldRechargeContext = Object.freeze({
    shields: player.condition.shields,
    maximumShields: vessel.maximumShields,
    repairing: player.condition.repairing,
  });
  const shields: unknown = rules.rechargePlayerShields(context);
  if (typeof shields !== 'number' || !Number.isFinite(shields)) throw new Error('Shield recharge must be finite.');
  if (shields < context.shields) throw new Error('Shield recharge cannot reduce shields.');
  if (shields > context.maximumShields) throw new Error('Shield recharge cannot exceed the vessel maximum.');
  return shields === context.shields ? undefined : shields;
}
