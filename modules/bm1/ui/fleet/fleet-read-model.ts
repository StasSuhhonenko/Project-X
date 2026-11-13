/** Literal UI-14 writers. The source description table disagrees with the
 * writers; display it unchanged. Health intentionally comes from myselect. */
import type { GameModuleDefinition } from '@engine/content/schemas/game-module';
import type { FleetView } from '@engine/ui/fleet-view';
import type { SelectedTargetView } from '@engine/ui/selected-target-view';

const orderDescriptions: Readonly<Record<string, string>> = Object.freeze({
  '1': 'escort your starship at Alert Green',
  '2': 'explore on its own at Alert Yellow',
  '3': 'gather at the planet at Alert Yellow',
  '4': 'attack your selected target',
});

/** One owner for the source's inclusive slot scans, including cleared holes.
 * numstations is the next slot at station completion, so starting at +1 skips
 * the first subsequently allocated actor (D13). A hole still runs the notice
 * writer, but cannot supply a live owned recipient or local-count entry. */
export function fleetSourceScan(fleet: FleetView, start = fleet.entrySlotCount + 1) {
  return {
    hasIterations: fleet.slotCursor >= start,
    ids: fleet.deployments
      .filter(link => link.slot >= start && link.slot <= fleet.slotCursor)
      .map(link => link.entityId),
  };
}

export function fleetReadModel(
  fleet: FleetView | null,
  hoveredId: string | null,
  target: SelectedTargetView | null,
  definition: GameModuleDefinition
) {
  const ship = fleet?.ships.find(ship => ship.entityId !== null && ship.entityId === hoveredId);
  const targetDefinition = definition.content.entityDefinitions.find(entity => entity.id === target?.definitionId);
  const strength = target?.kind === 'npc-ship' ? target.hull + target.shields : target?.combat?.strength;
  const maximum =
    target?.kind === 'npc-ship' && targetDefinition?.category === 'ship'
      ? targetDefinition.maximumHull + targetDefinition.maximumShields
      : target?.kind === 'station'
        ? target.combat?.maximumStrength
        : undefined;
  return Object.freeze({
    selectedname: ship?.name ?? '',
    selecteddesc: ship
      ? `This ship has orders to ${orderDescriptions[ship.orderId ?? ''] ?? 'undefined'}`
      : `Local Fleet: ${fleet ? fleetSourceScan(fleet).ids.length : 0}`,
    selectedDefinitionId: ship?.definitionId ?? null,
    healthCoverPercent: strength !== undefined && maximum && maximum > 0 ? 100 - (strength / maximum) * 100 : 100,
  });
}

export function storedCraftReport(fleet: FleetView, definition: GameModuleDefinition): string {
  const entries = fleet.ships
    .filter(ship => ship.systemId === null)
    .map(ship => {
      const vessel = definition.content.entityDefinitions.find(entity => entity.id === ship.definitionId);
      if (!vessel) throw new Error('Stored fleet vessel definition is unavailable.');
      return `${ship.name}(${vessel.name}); `;
    })
    .join('');
  return `Craft stored in shuttlebay...\n\n   ${entries}`;
}
