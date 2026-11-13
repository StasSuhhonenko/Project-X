/** Converts source keyboard/pointer commands to authenticated host intents.
 * Recipient facts are read anew for every command; UI selection never becomes
 * simulation authority. Notices remain at their distinct source receivers. */
import {
  fleetKeyboardNotices,
  fleetPointerNotices,
  inFleetStageRectangle,
  type FleetCommand,
} from '../../fleet-order-rules';
import type { GameplayPresentationProps } from '../../presentation-contract';
import { worldToSourceStage } from '../../source-geometry';
import type { HudAction } from '../hud/hud-content';
import { fleetSourceScan, storedCraftReport } from './fleet-read-model';

interface FleetHost {
  readonly fleet: GameplayPresentationProps['fleet'];
  readonly onIssueFleetOrder: GameplayPresentationProps['onIssueFleetOrder'];
  readonly onSetFleetMission: GameplayPresentationProps['onSetFleetMission'];
  readonly onLaunchStowedFleet: GameplayPresentationProps['onLaunchStowedFleet'];
  readonly onRecallFleet: GameplayPresentationProps['onRecallFleet'];
}
export interface FleetCommandContext extends FleetHost {
  readonly playerSize: number;
  readonly selectedIds: readonly string[];
  readonly hint: (text: string) => void;
  readonly clearSelection: () => void;
}

/** True means this source key branch acquires hitkey, even with zero recipients.
 * Undersized keyboard recall and an absent capability acquire no latch. */
export function dispatchFleetCommand(
  context: FleetCommandContext,
  command: FleetCommand,
  origin: 'keyboard' | 'pointer'
): boolean {
  if (!context.fleet?.ordersAvailable) return false;
  const keyboard = origin === 'keyboard';
  if (command === 'recall' && context.playerSize < 5) {
    if (!keyboard) context.hint(fleetPointerNotices.tooSmall);
    return !keyboard;
  }
  const order = ['escort', 'attack', 'seek', 'gather'].includes(command);
  // Keys1–4 start after numstations+1. Keys6–8 start at slot1; launch uses
  // persisted roster order instead and has no live scan restriction.
  const scan = fleetSourceScan(context.fleet, order ? context.fleet.entrySlotCount + 1 : 1);
  const recipientEntityIds = keyboard ? scan.ids : context.selectedIds;
  const notice = keyboard && (!order || scan.hasIterations) ? { notice: fleetKeyboardNotices[command] } : {};
  if (order) {
    context.onIssueFleetOrder?.({ commandId: `${origin}:${command}`, recipientEntityIds, ...notice });
    if (!keyboard) context.hint(fleetPointerNotices.confirmed);
    return true;
  }
  if (command === 'launch') {
    context.onLaunchStowedFleet?.(notice);
    if (!keyboard) context.hint(fleetPointerNotices.launch);
    return true;
  }
  if (command === 'recall') {
    context.onRecallFleet?.({ recipientEntityIds, ...notice });
    if (!keyboard) {
      context.clearSelection();
      context.hint(fleetPointerNotices.recall);
    }
    return true;
  }
  context.onSetFleetMission?.({ missionId: command === 'explore' ? '2' : '1', recipientEntityIds, ...notice });
  return true;
}

/** All ten UI-14 releases converge here; rollover feedback stays with HUD Hit
 * controls. Nearby uses the source's separate 400px bottom, recall uses 500px. */
export function dispatchFleetControl(
  context: FleetCommandContext & {
    readonly definition: GameplayPresentationProps['definition'];
    readonly overview: NonNullable<GameplayPresentationProps['spatialOverview']>;
    readonly zoom: number;
    readonly replaceSelection: (ids: readonly string[]) => void;
    readonly showReport: (text: string) => void;
  },
  action: HudAction
): boolean {
  if (!context.fleet?.ordersAvailable) return false;
  if (action === 'fleet-clear') {
    context.clearSelection();
    context.hint('');
    return true;
  }
  if (action === 'fleet-stored') {
    context.showReport(storedCraftReport(context.fleet, context.definition));
    return true;
  }
  if (action === 'fleet-all' || action === 'fleet-nearby') {
    const ids = fleetSourceScan(context.fleet).ids.filter(id => {
      if (action === 'fleet-all') return true;
      const actor = context.overview.find(actor => actor.id === id);
      if (!actor) return false;
      return inFleetStageRectangle(
        worldToSourceStage({ x: actor.relativeX, y: actor.relativeY }, { x: 0, y: 0 }, context.zoom),
        400
      );
    });
    context.replaceSelection(ids);
    context.hint('');
    return true;
  }
  const command = action.slice(6);
  if (
    command === 'escort' ||
    command === 'attack' ||
    command === 'seek' ||
    command === 'gather' ||
    command === 'launch' ||
    command === 'recall'
  )
    return dispatchFleetCommand(context, command, 'pointer');
  return false;
}
