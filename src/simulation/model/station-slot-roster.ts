/** Canonical stationary prefix of the sparse NPC/special-effect roster.
 * Authored visit holes retain their source order; constructed entry actors
 * follow in creation order. Pending markers never consume a slot. A destroyed
 * constructed deployment remains a historical hole until the next departure. */
import type { WorldState } from './world-state';

export function stationActorSlots(world: WorldState): readonly (string | null)[] {
  const constructedIds = new Set(world.construction?.stations.map(station => station.id) ?? []);
  const authored = world.lifecycle.stationSpawnSlots ?? [
    null,
    ...world.entities
      .filter(entity => entity.kind === 'station')
      .filter(entity => !entity.construction && !constructedIds.has(entity.stationId))
      .map(entity => entity.id),
  ];
  const constructed =
    world.construction?.stations.flatMap(station => {
      const link = world.construction!.deployments.find(link => link.stationId === station.id);
      if (!link || station.phase.kind === 'pending') return [];
      return [station.phase.kind === 'destroyed' ? null : link.entityId];
    }) ?? [];
  return Object.freeze([...authored, ...constructed]);
}
