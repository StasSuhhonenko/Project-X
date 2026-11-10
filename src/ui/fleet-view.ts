/** Frozen fleet read model. Intent prices are display data, never authority. */
import { z } from 'zod';
import type { AppStoreState } from '../app/app-store';
import type { GameModule } from '../content/game-module';
import { FleetAcquisitionDecisionSchema, FleetReleaseQuoteSchema } from '../simulation/contracts/fleet-rules';
import {
  FleetAcquisitionIntentSchema,
  FleetReleaseIntentSchema,
  quoteFleetAcquisition,
  quoteFleetRelease,
} from '../simulation/features/fleet';
import { RuntimeEntityIdSchema } from '../simulation/model/entity-components';
import { OwnedShipIdSchema } from '../simulation/model/fleet-state';
import { selectPlayerEntity } from '../simulation/model/world-state';
import { selectVesselOfferSources } from './vessel-purchase-view';

export const FleetViewSchema = z
  .object({
    ships: z
      .array(
        z
          .object({
            ownedShipId: OwnedShipIdSchema,
            definitionId: z.number().int().positive(),
            name: z.string(),
            systemId: z.number().int().positive(),
            entityId: RuntimeEntityIdSchema.nullable(),
          })
          .strict()
          .readonly()
      )
      .readonly(),
    acquisitionOffers: z
      .array(
        z
          .object({ intent: FleetAcquisitionIntentSchema, decision: FleetAcquisitionDecisionSchema.nullable() })
          .strict()
          .readonly()
      )
      .readonly(),
    releaseOffers: z
      .array(
        z
          .object({
            intent: FleetReleaseIntentSchema,
            definitionId: z.number().int().positive(),
            name: z.string(),
            quote: FleetReleaseQuoteSchema,
          })
          .strict()
          .readonly()
      )
      .readonly(),
  })
  .strict()
  .readonly();
export type FleetView = z.infer<typeof FleetViewSchema>;
export function selectFleetView(state: AppStoreState, game: GameModule): FleetView | null {
  const world = state.world;
  if (!game.rules.fleet || !world?.fleet) return null;
  const fleet = world.fleet;
  const player = selectPlayerEntity(world);
  const planet = world.entities.find(actor => actor.kind === 'planet');
  const currency = { sessionRevision: state.sessionRevision, rosterRevision: fleet.nextOwnedShipSequence };
  return FleetViewSchema.parse({
    ships: fleet.ships.map(ship => ({
      ownedShipId: ship.id,
      definitionId: ship.definitionId,
      name: ship.name,
      systemId: ship.systemId,
      entityId: fleet.deployments.find(link => link.ownedShipId === ship.id)?.entityId ?? null,
    })),
    acquisitionOffers:
      !planet || world.status !== 'active'
        ? []
        : selectVesselOfferSources(world, game).flatMap(source =>
            [...new Set(source.ids)].flatMap(id => {
              if (id === null || !game.catalog.getShipDefinition(id)) return [];
              return [
                {
                  intent: {
                    ...currency,
                    systemId: player.location.systemId,
                    planetEntityId: planet.id,
                    ...(source.stationEntityId ? { stationEntityId: source.stationEntityId } : {}),
                    vesselDefinitionId: id,
                  },
                  decision: quoteFleetAcquisition(world, game, id, source.stationEntityId),
                },
              ];
            })
          ),
    releaseOffers: world.specialActorSlots.flatMap(entityId => {
      const link = fleet.deployments.find(link => link.entityId === entityId);
      if (!link) return [];
      const ship = fleet.ships.find(ship => ship.id === link.ownedShipId)!;
      const quote = quoteFleetRelease(world, game, ship.id, link.entityId);
      return quote
        ? [
            {
              intent: { ...currency, ownedShipId: ship.id, entityId: link.entityId },
              definitionId: ship.definitionId,
              name: ship.name,
              quote,
            },
          ]
        : [];
    }),
  });
}

/** Invalidation inputs omit actor motion, damage percentages and tick counters:
 * those are not displayed here. Death/release change the authoritative join;
 * ordinary station removal and selection change the available source set. */
export function selectFleetInputs(state: AppStoreState) {
  const world = state.world;
  if (!world?.fleet) return null;
  const player = selectPlayerEntity(world);
  return {
    fleet: world.fleet,
    sessionRevision: state.sessionRevision,
    systemId: player.location.systemId,
    resources: player.inventory.resources,
    marketAdjustment: player.equipment?.marketAdjustment ?? null,
    repairing: player.condition.repairing,
    status: world.status,
    selectedTargetEntityId: world.selectedTargetEntityId,
    planetEntityId: world.entities.find(actor => actor.kind === 'planet')?.id ?? null,
    stationEntityIds: world.entities
      .filter(actor => actor.kind === 'station')
      .map(actor => actor.id)
      .join(','),
  };
}
