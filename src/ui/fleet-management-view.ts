/** Frozen facts for attaching management to a station and displaying roster rows. */
import { z } from 'zod';
import type { AppStoreState } from '../app/app-store';
import type { GameModule } from '../content/game-module';
import { canSendFleetToSystem, selectFleetManagementStations } from '../simulation/features/fleet-management';
import { RuntimeEntityIdSchema, SystemIdSchema } from '../simulation/model/entity-components';
import { OwnedShipSchema, type FleetState } from '../simulation/model/fleet-state';
import type { SystemStanding } from '../simulation/model/lifecycle-state';
import { selectSystemStandingView } from './system-standing-view';

const FleetManagementRowSchema = OwnedShipSchema.unwrap()
  .pick({ definitionId: true, name: true, systemId: true })
  .extend({
    ownedShipId: OwnedShipSchema.unwrap().shape.id,
    entityId: RuntimeEntityIdSchema.nullable(),
    missionId: OwnedShipSchema.unwrap().shape.missionId.unwrap(),
    /** Standing in the row's system. Stored rows and missing scopes have no value. */
    standing: z.number().finite().nullable(),
  })
  .strict()
  .readonly();

export const FleetManagementViewSchema = z
  .object({
    /** Eligible live stations in actor slot order, independent of selection. */
    stationEntityIds: z.array(RuntimeEntityIdSchema).min(1).readonly(),
    destinations: z.array(z.object({ systemId: SystemIdSchema, sendable: z.boolean() }).strict().readonly()).readonly(),
    rows: z.array(FleetManagementRowSchema).readonly(),
  })
  .strict()
  .readonly();
export type FleetManagementView = z.infer<typeof FleetManagementViewSchema>;

interface ManagementViewCache {
  readonly stationKey: string;
  readonly rowKey: string;
  readonly fleet: FleetState;
  readonly standing: readonly SystemStanding[];
  readonly view: FleetManagementView;
}
const views = new WeakMap<GameModule, ManagementViewCache>();

/** Recheck live access on every selection. Reproject rows only when their
 * owning components change, and reuse the view if a full-world parse produced
 * new component references with identical display facts. */
export function selectFleetManagementView(state: AppStoreState, game: GameModule): FleetManagementView | null {
  const world = state.world;
  const fleet = world?.fleet;
  const management = game.rules.fleet?.management;
  if (!world || !fleet || !management) return null;
  const stationEntityIds = selectFleetManagementStations(world, game).map(station => station.id);
  if (stationEntityIds.length === 0) return null;
  const stationKey = stationEntityIds.join(',');
  const standing = world.lifecycle.systemStanding;
  const cached = views.get(game);
  if (cached?.stationKey === stationKey && cached.fleet === fleet && cached.standing === standing) return cached.view;

  const deploymentIds = new Map(fleet.deployments.map(link => [link.ownedShipId, link.entityId]));
  const rows = fleet.ships.map(ship => ({
    definitionId: ship.definitionId,
    name: ship.name,
    systemId: ship.systemId,
    ownedShipId: ship.id,
    entityId: deploymentIds.get(ship.id) ?? null,
    missionId: ship.missionId ?? null,
    standing: ship.systemId === null ? null : (selectSystemStandingView(state, ship.systemId)?.value ?? null),
  }));
  const rowKey = JSON.stringify(rows);
  const view =
    cached?.stationKey === stationKey && cached.rowKey === rowKey
      ? cached.view
      : FleetManagementViewSchema.parse({
          stationEntityIds,
          destinations:
            cached?.view.destinations ??
            management.declarations.destinationSystemIds.map(systemId => ({
              systemId,
              sendable: canSendFleetToSystem(game, systemId),
            })),
          rows,
        });
  views.set(game, { stationKey, rowKey, fleet, standing, view });
  return view;
}
