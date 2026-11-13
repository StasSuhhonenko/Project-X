/** C12 source commands. Only this module interprets BM1 order/mission numbers;
 * the engine validates ownership, joins, writes and atomic publication.
 * Evidence: docs/features/c12-fleet-orders/C12_FLEET_ORDERS_RECOVERY.md. */
import { z } from 'zod';
import type { FleetOrderRules } from '@engine/simulation/contracts/fleet-rules';
import { worldToSourceStage } from './source-geometry';

export const FleetCommandSchema = z.enum([
  'escort',
  'attack',
  'seek',
  'gather',
  'launch',
  'recall',
  'explore',
  'trade',
]);
export type FleetCommand = z.infer<typeof FleetCommandSchema>;
export const fleetKeyboardCommands = Object.freeze([...FleetCommandSchema.options]);
/** Keyboard 3 deliberately writes attack; keyboard 4 deliberately says seek. */
export const fleetKeyboardNotices: Readonly<Record<FleetCommand, string>> = Object.freeze({
  escort: 'Fleet ordered to follow you under green alert...',
  attack: 'Fleet ordered to attack your selected target...',
  seek: 'Fleet ordered to Seek and Destroy enemy targets...',
  gather: 'Fleet ordered to Seek and Destroy enemy targets...',
  launch: 'Launching all auxiliary craft...',
  recall: 'All nearby auxiliary craft loaded into shuttlebay...',
  explore: 'All ships in this system ordered to explore the galaxy...',
  trade: 'All ships in this system ordered to conduct trade missions...',
});
export const fleetPointerNotices = Object.freeze({
  confirmed: 'Orders confirmed...',
  launch: 'Auxiliary craft deployed...',
  recall: 'Auxiliary craft loaded and secured...',
  tooSmall: 'This ship is too small to carry auxiliary craft...',
});
/** Strict stage pixels, not radial range or viewport-scaled browser pixels. */
export function inFleetStageRectangle(position: Readonly<{ x: number; y: number }>, bottom: number): boolean {
  return position.x > 0 && position.x < 650 && position.y > 0 && position.y < bottom;
}

export const fleetOrders: FleetOrderRules = Object.freeze<FleetOrderRules>({
  declaredOrders: Object.freeze(['1', '2', '3', '4'].map(id => Object.freeze({ id, followsTravel: id === '1' }))),
  declaredMissions: Object.freeze(['1', '2']),
  resolveOrder(context) {
    const [origin, input, ...extra] = context.commandId.split(':');
    if (extra.length > 0) throw new Error('Malformed fleet command.');
    if (origin !== 'keyboard' && origin !== 'pointer') throw new Error('Unknown fleet command origin.');
    const command = FleetCommandSchema.parse(input);
    if (!['escort', 'attack', 'seek', 'gather'].includes(command)) throw new Error('Expected a live fleet order.');
    const attack = command === 'attack' || (origin === 'keyboard' && command === 'seek');
    const orderId = attack ? '4' : command === 'escort' ? '1' : command === 'seek' ? '3' : '2';
    const targetEntityId = attack
      ? context.selectedTargetEntityId
      : command === 'escort'
        ? context.playerEntityId
        : context.planetEntityId;
    return {
      writes: context.recipientEntityIds.map(entityId => ({
        entityId,
        orderId,
        alert: attack ? ('combat' as const) : ('peaceful' as const),
        targetEntityId,
      })),
      // Keyboard scan feedback depends on live slots, including hostile slots,
      // which are intentionally outside this focused policy context. The UI
      // supplies it explicitly; pointer feedback belongs only to panel infotext.
      notice: null,
    };
  },
  canRecall(context) {
    if (context.playerVessel.sizeClass < 5 || context.craftVessel.sizeClass > 1) return false;
    return inFleetStageRectangle(
      worldToSourceStage(context.craftPosition, context.playerPosition, context.cameraZoom),
      500
    );
  },
});
