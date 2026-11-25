/** Station combat requires a mutable authored record or a live deployment
 * of a completed construction record. A visit can still retain historical
 * deployment links after death, so deployment alone does not grant combat. */
import type { LifecycleDefinition } from '../../content/schemas/lifecycle-content';
import type { StationEntity } from '../model/world-schema';
import type { WorldState } from '../model/world-state';

export function isAttackableStation(
  world: WorldState,
  station: StationEntity,
  lifecycle?: LifecycleDefinition
): station is StationEntity & { combat: NonNullable<StationEntity['combat']> } {
  if (!station.combat) return false;
  const construction = world.construction;
  const deployment = construction?.deployments.find(link => link.entityId === station.id);
  if (!deployment) return lifecycle?.mutableStationRecordIds.includes(station.combat.recordId) ?? false;
  return (
    deployment.stationId === station.stationId &&
    deployment.stationId === station.combat.recordId &&
    (construction?.stations.some(record => record.id === deployment.stationId && record.phase.kind === 'complete') ??
      false)
  );
}
