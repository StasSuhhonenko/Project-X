/** Persistent ownership, independent of disposable visit actor identity.
 * Allocator IDs never recycle, including after death or release. */
import { z } from 'zod';
import { EncounterNameSchema } from '../contracts/encounter-rules';
import { PositiveDefinitionIdSchema, RuntimeEntityIdSchema, SystemIdSchema } from './entity-components';

export const OwnedShipIdSchema = z.string().regex(/^owned-[1-9][0-9]*$/);
export type OwnedShipId = z.infer<typeof OwnedShipIdSchema>;
export const OwnedShipSchema = z
  .object({
    id: OwnedShipIdSchema,
    definitionId: PositiveDefinitionIdSchema,
    name: EncounterNameSchema,
    raceId: z.number().int().positive().nullable(),
    systemId: SystemIdSchema,
  })
  .strict()
  .readonly();
export const FleetStateSchema = z
  .object({
    nextOwnedShipSequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    ships: z.array(OwnedShipSchema).readonly(),
    deployments: z
      .array(z.object({ ownedShipId: OwnedShipIdSchema, entityId: RuntimeEntityIdSchema }).strict().readonly())
      .readonly(),
  })
  .strict()
  .superRefine((fleet, context) => {
    const shipIds = fleet.ships.map(ship => ship.id);
    if (
      new Set(shipIds).size !== shipIds.length ||
      fleet.ships.some(
        ship =>
          !Number.isSafeInteger(Number(ship.id.slice(6))) || Number(ship.id.slice(6)) >= fleet.nextOwnedShipSequence
      )
    )
      context.addIssue({ code: 'custom', message: 'Owned IDs must be unique and below the allocator.' });
    if (
      new Set(fleet.deployments.map(link => link.ownedShipId)).size !== fleet.deployments.length ||
      new Set(fleet.deployments.map(link => link.entityId)).size !== fleet.deployments.length ||
      fleet.deployments.some(link => !shipIds.includes(link.ownedShipId))
    )
      context.addIssue({ code: 'custom', message: 'Deployments must join unique roster ships and actors.' });
  })
  .readonly();
export type OwnedShip = z.infer<typeof OwnedShipSchema>;
export type FleetState = z.infer<typeof FleetStateSchema>;

/** Reconcile death before world parsing so no dangling deployment is published.
 * This pure projection also serves the outcome-free destruction compatibility host. */
export function fleetAfterDeaths(fleet: FleetState, entityIds: ReadonlySet<string>): FleetState {
  const removed = new Set(fleet.deployments.filter(link => entityIds.has(link.entityId)).map(link => link.ownedShipId));
  if (removed.size === 0) return fleet;
  return FleetStateSchema.parse({
    ...fleet,
    ships: fleet.ships.filter(ship => !removed.has(ship.id)),
    deployments: fleet.deployments.filter(link => !removed.has(link.ownedShipId)),
  });
}
