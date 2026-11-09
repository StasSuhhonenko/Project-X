/** View-owned cloak interpolation. Saves retain the cloak flag, while a view
 * restore settles directly at its declared opacity without replaying a fade. */
import { z } from 'zod';
import type { WorldState } from '../../simulation/model/world-state';

export const CloakAppearanceSchema = z
  .object({
    fadePerTick: z.number().finite().positive().max(1),
    playerAlpha: z.number().finite().min(0).max(1),
    npcAlpha: z.number().finite().min(0).max(1),
  })
  .strict()
  .readonly();
export type CloakAppearance = z.infer<typeof CloakAppearanceSchema>;

export function createActorOpacity(
  initialWorld: WorldState,
  policy: CloakAppearance = { fadePerTick: 1, playerAlpha: 0.5, npcAlpha: 0 }
) {
  const goal = (entity: WorldState['entities'][number]): number => {
    if (entity.kind === 'npc-ship') return entity.combat.opacity / 100;
    if (entity.kind === 'station' && entity.combat) return entity.combat.state.opacity / 100;
    if (entity.kind !== 'player-ship') return 1;
    if (!entity.specialStatus.cloaked) return 1;
    return policy.playerAlpha;
  };
  let tick = initialWorld.tick;
  let current = new Map(initialWorld.entities.map(entity => [entity.id, goal(entity)]));
  let previous = current;
  const synchronize = (world: WorldState, reset = false): void => {
    if (!reset && tick === world.tick) return;
    tick = world.tick;
    previous = current;
    current = new Map(
      world.entities.map(entity => {
        const target = goal(entity);
        if (reset || entity.kind !== 'player-ship' || !previous.has(entity.id)) return [entity.id, target];
        const before = previous.get(entity.id)!;
        const after = before + Math.sign(target - before) * Math.min(Math.abs(target - before), policy.fadePerTick);
        return [entity.id, after];
      })
    );
    if (reset) previous = current;
  };
  return Object.freeze({
    advance: (world: WorldState) => synchronize(world),
    reset: (world: WorldState) => synchronize(world, true),
    sample: (id: string, alpha: number): number => {
      const end = current.get(id) ?? 1;
      return (previous.get(id) ?? end) + (end - (previous.get(id) ?? end)) * alpha;
    },
  });
}
