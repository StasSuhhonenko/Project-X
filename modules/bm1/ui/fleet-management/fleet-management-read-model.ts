/** Type 25's two dynamic receivers. All ship and standing facts come from the
 * host publication. Source map labels also cover stops without spatial content. */
import type { GameModuleDefinition } from '@engine/content/schemas/game-module';
import type { FleetManagementView } from '@engine/ui/fleet-management-view';
import { constructionDestinationNames } from '../../construction-rules';
import { FLEET_PATROL_MISSION_ID, FLEET_TRADE_MISSION_ID } from '../../fleet-order-rules';
import { fleetManagementContent, type FleetManagementAction } from './fleet-management-content';

export type FleetManagementRow = FleetManagementView['rows'][number];
export const DECOMMISSION_CONFIRMATION_HINT = 'Click Decommission again to confirm...CANNOT BE UNDONE!';

function missionSentence(missionId: FleetManagementRow['missionId']): string {
  if (missionId === FLEET_TRADE_MISSION_ID) return 'This ship is conducting trade missions.';
  if (missionId === FLEET_PATROL_MISSION_ID) return 'This ship is patrolling the galaxy.';
  return 'This ship has no orders.';
}

function mapLabel(systemId: number | null): string {
  return systemId === null ? '' : (constructionDestinationNames[systemId] ?? '');
}

export function createFleetManagementReadModel(
  row: FleetManagementRow | null,
  destinationSystemId: number | null,
  definition: Pick<GameModuleDefinition, 'content'>
) {
  if (!row) return Object.freeze({ loctext: '', itemdesc: 'No ship to display...', portraitDefinitionId: null });
  const hull = definition.content.entityDefinitions.find(entity => entity.id === row.definitionId);
  if (hull?.category !== 'ship') throw new Error(`Missing managed hull definition ${row.definitionId}.`);
  // SWF 6 takes the friendly branch for missing or zero standing. The raw
  // size class supplies the maintenance copy. This UI does no upkeep arithmetic.
  const territory =
    row.systemId !== null && (row.standing ?? 0) < 0
      ? 'In Enemy Territory (Red Alert)'
      : 'In Friendly Territory (Green Alert)';
  return Object.freeze({
    loctext: mapLabel(destinationSystemId),
    itemdesc: [
      `Name: ${row.name}`,
      `Class: ${hull.name}`,
      `Location: ${mapLabel(row.systemId)}`,
      `Daily Maint. Cost: ${hull.sizeClass} bars`,
      `Status: ${territory}; ${missionSentence(row.missionId)}`,
      '',
      'Comm channel open...',
    ].join('\n'),
    portraitDefinitionId: hull.id,
  });
}

export function fleetManagementHint(action: FleetManagementAction | null, armed: boolean): string {
  if (armed && (action === null || action === 'decommission')) return DECOMMISSION_CONFIRMATION_HINT;
  return fleetManagementContent.controls.find(control => control.action === action)?.hint ?? '';
}
