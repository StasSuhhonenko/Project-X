/** Frozen current-scene geometry for overview/minimap presentation. No inactive
 * world cache, faction inference or renderer objects cross this boundary. */
import { z } from 'zod';
import type { AppStoreState } from '../app/app-store';
import { actorNavigation, isDecisionActor } from '../simulation/model/decision-actor';
import { RuntimeEntityIdSchema } from '../simulation/model/entity-components';
import { selectPlayerEntity } from '../simulation/model/world-state';

export const WorldActivationSchema = z
  .object({
    sequence: z.number().int().positive(),
    id: RuntimeEntityIdSchema,
    kind: z.enum(['planet', 'station', 'npc-ship']),
    selectedBefore: z.boolean(),
  })
  .strict()
  .readonly();
export type WorldActivation = z.infer<typeof WorldActivationSchema>;
export const SpatialOverviewSchema = z
  .array(
    z
      .object({
        id: RuntimeEntityIdSchema,
        kind: z.enum(['planet', 'station', 'npc-ship']),
        /** Content definition of a selectable entity, so a presentation can
         * prepare its artwork before selection. Planets have none. */
        definitionId: z.number().int().positive().optional(),
        relativeX: z.number().finite(),
        relativeY: z.number().finite(),
        selected: z.boolean(),
        cloaked: z.boolean().optional(),
        /** Live navigation intent of any decision actor (ship or combat station);
         * presentation must not infer hostility from allegiance. */
        targetsPlayer: z.boolean().optional(),
      })
      .strict()
      .readonly()
  )
  .readonly();
export type SpatialOverview = z.infer<typeof SpatialOverviewSchema>;

/** World units relative to the player; display scale and edge rules belong to
 * the selected presentation. Removed entities disappear in the same publication. */
export function selectSpatialOverview(state: AppStoreState): SpatialOverview {
  const world = state.world;
  if (!world || world.status !== 'active') return Object.freeze([]);
  const player = selectPlayerEntity(world);
  return Object.freeze(
    world.entities.flatMap(entity => {
      if (entity.kind === 'player-ship' || entity.location.systemId !== player.location.systemId) return [];
      return [
        Object.freeze({
          id: entity.id,
          kind: entity.kind,
          ...(entity.kind === 'planet' ? {} : { definitionId: entity.definitionId }),
          relativeX: entity.location.position.x - player.location.position.x,
          relativeY: entity.location.position.y - player.location.position.y,
          selected: entity.id === world.selectedTargetEntityId,
          ...(isDecisionActor(entity) ? { targetsPlayer: actorNavigation(entity).targetEntityId === player.id } : {}),
          ...(entity.kind === 'npc-ship' && entity.combat.cloaked ? { cloaked: true } : {}),
        }),
      ];
    })
  );
}
