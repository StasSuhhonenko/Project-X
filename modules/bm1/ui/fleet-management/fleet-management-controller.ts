/** Local attachment and cursor. The host owns all roster writes and the facts
 * used to reconcile a pending decommission. */
import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import type { FleetManagementIntent } from '@engine/simulation/features/fleet-management';
import { RuntimeEntityIdSchema, SystemIdSchema } from '@engine/simulation/model/entity-components';
import { OwnedShipIdSchema } from '@engine/simulation/model/fleet-state';
import type { FleetManagementView } from '@engine/ui/fleet-management-view';
import { FLEET_PATROL_MISSION_ID, FLEET_TRADE_MISSION_ID } from '../../fleet-order-rules';
import { CONTACT_LAYOUT as layout } from '../contact/contact-layout';
import { stepToward } from '../frame-step';
import type { FleetManagementAction } from './fleet-management-content';
import type { FleetManagementRow } from './fleet-management-read-model';

const AttachmentSchema = z
  .object({
    stationEntityId: RuntimeEntityIdSchema,
    selectedOwnedShipId: OwnedShipIdSchema.nullable(),
    // Zero-based row position, or the gap between surviving rows after removal.
    cursor: z.number().int().nonnegative(),
    decommissionGap: z.boolean(),
    destinationSystemId: SystemIdSchema.nullable(),
    armedOwnedShipId: OwnedShipIdSchema.nullable(),
    scale: z.number().min(layout.initialScale).max(layout.maximumScale),
  })
  .strict()
  .readonly();
const SnapshotSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    attachment: AttachmentSchema.nullable(),
  })
  .strict()
  .readonly();
type Attachment = z.infer<typeof AttachmentSchema>;
type ManageFleet = (intent: FleetManagementIntent) => boolean;

const sameRow = (a: FleetManagementRow, b: FleetManagementRow) =>
  a.ownedShipId === b.ownedShipId &&
  a.definitionId === b.definitionId &&
  a.name === b.name &&
  a.systemId === b.systemId &&
  a.entityId === b.entityId &&
  a.missionId === b.missionId &&
  a.standing === b.standing;
const rowState = (row: FleetManagementRow | undefined, cursor: number) => ({
  cursor,
  decommissionGap: false,
  selectedOwnedShipId: row?.ownedShipId ?? null,
  destinationSystemId: row?.systemId ?? null,
  armedOwnedShipId: null,
});

export function createFleetManagementController() {
  const store = createStore(() => SnapshotSchema.parse({ revision: 0, attachment: null }));
  // The previous immutable publication is a comparison witness only. Renderers
  // and intent validation always read the current view supplied by the host.
  let previousRows: FleetManagementView['rows'] = [];
  let requestedRemoval: string | null = null;
  const update = (attachment: Attachment | null, revision = store.getState().revision) =>
    store.setState(SnapshotSchema.parse({ revision, attachment }), true);

  const close = () => {
    previousRows = [];
    requestedRemoval = null;
    if (store.getState().attachment) update(null);
  };

  function reconcile(view: FleetManagementView | null) {
    const { attachment } = store.getState();
    if (!attachment) return;
    if (!view?.stationEntityIds.includes(attachment.stationEntityId)) {
      close();
      return;
    }
    const rows = view.rows;
    const changed =
      rows.length !== previousRows.length || rows.some((row, index) => !sameRow(row, previousRows[index]!));
    if (!changed) return;
    const former = previousRows.find(row => row.ownedShipId === attachment.selectedOwnedShipId);
    previousRows = rows;
    const removed =
      requestedRemoval !== null && !rows.some(row => row.ownedShipId === requestedRemoval) ? requestedRemoval : null;
    if (removed) requestedRemoval = null;
    const index = rows.findIndex(row => row.ownedShipId === attachment.selectedOwnedShipId);
    const current = rows[index];
    if (current) {
      const refreshDraft = current.systemId !== former?.systemId || current.missionId !== former?.missionId;
      update({
        ...attachment,
        cursor: index,
        destinationSystemId: refreshDraft ? current.systemId : attachment.destinationSystemId,
        armedOwnedShipId: null,
      });
      return;
    }
    // An empty roster can acquire a first row. A decommission gap stays empty
    // across later publications until a browse action selects a neighbour.
    if (attachment.decommissionGap || (removed !== null && removed === attachment.selectedOwnedShipId)) {
      update({
        ...attachment,
        ...rowState(undefined, Math.min(attachment.cursor, rows.length)),
        decommissionGap: true,
      });
      return;
    }
    const cursor = Math.max(0, Math.min(attachment.cursor, rows.length - 1));
    update({ ...attachment, ...rowState(rows[cursor], cursor) });
  }

  function release(action: FleetManagementAction, view: FleetManagementView | null, onManageFleet?: ManageFleet) {
    reconcile(view);
    const { attachment } = store.getState();
    if (!attachment || !view) return;
    if (action === 'exit') {
      close();
      return;
    }
    const row = view.rows.find(candidate => candidate.ownedShipId === attachment.selectedOwnedShipId);
    const disarmed = { ...attachment, armedOwnedShipId: null };
    if (action === 'next' || action === 'previous') {
      const index = attachment.cursor;
      // There is no row at a gap. Next uses its right neighbour at the gap's
      // index while Previous uses its left neighbour one position earlier.
      const next = action === 'previous' ? index - 1 : index + Number(Boolean(row));
      if (!row && !view.rows[next]) {
        // Keep the gap when there is no surviving neighbour in this direction.
        return;
      }
      const cursor = Math.max(0, Math.min(next, view.rows.length - 1));
      if (cursor !== index || !row) {
        update({ ...disarmed, ...rowState(view.rows[cursor], cursor) });
        return;
      }
      if (attachment.armedOwnedShipId) update(disarmed);
      return;
    }
    if (!row) return;
    const { stationEntityId } = attachment;
    const { ownedShipId } = row;
    const recipient = { stationEntityId, ownedShipId };
    if (action === 'decommission' && attachment.armedOwnedShipId !== ownedShipId) {
      if (onManageFleet) update({ ...attachment, armedOwnedShipId: ownedShipId });
      return;
    }
    const { destinations } = view;
    const draftIndex = destinations.findIndex(destination => destination.systemId === attachment.destinationSystemId);
    if (action === 'destination-next' || action === 'destination-previous') {
      if (!destinations.length) {
        if (attachment.armedOwnedShipId) update(disarmed);
        return;
      }
      const delta = action === 'destination-next' ? 1 : -1;
      // An unset draft steps directly to the appropriate endpoint (M4).
      const origin = draftIndex < 0 && delta < 0 ? 0 : draftIndex;
      const next = destinations[(origin + delta + destinations.length) % destinations.length]!;
      update({ ...disarmed, destinationSystemId: next.systemId });
      return;
    }
    if (attachment.armedOwnedShipId) update(disarmed);
    if (action === 'decommission') {
      requestedRemoval = ownedShipId;
      if (!onManageFleet?.({ ...recipient, kind: 'decommission' })) requestedRemoval = null;
      return;
    }
    if (action === 'send') {
      const destination = destinations[draftIndex];
      if (!destination?.sendable || destination.systemId === row.systemId) return;
      onManageFleet?.({ ...recipient, kind: 'send', destinationSystemId: destination.systemId });
      return;
    }
    if (action === 'trade' || action === 'patrol') {
      const missionId = action === 'trade' ? FLEET_TRADE_MISSION_ID : FLEET_PATROL_MISSION_ID;
      onManageFleet?.({ ...recipient, kind: 'set-mission', missionId });
    }
  }

  return Object.freeze({
    getSnapshot: store.getState,
    subscribe: (listener: () => void) => store.subscribe(listener),
    open: (stationEntityId: string, view: FleetManagementView) => {
      if (!view.stationEntityIds.includes(stationEntityId)) return false;
      previousRows = view.rows;
      requestedRemoval = null;
      update(
        { stationEntityId, ...rowState(view.rows[0], 0), scale: layout.initialScale },
        store.getState().revision + 1
      );
      return true;
    },
    close,
    reconcile,
    release,
    advance: () => {
      const { attachment } = store.getState();
      if (!attachment || attachment.scale === layout.maximumScale) return;
      update({ ...attachment, scale: stepToward(attachment.scale, layout.maximumScale, layout.growthPerFrame) });
    },
  });
}
export type FleetManagementController = ReturnType<typeof createFleetManagementController>;
