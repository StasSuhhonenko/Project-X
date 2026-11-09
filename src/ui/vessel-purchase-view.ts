/** Display-only planet and selected-station offers. Nullable approval means currently unavailable;
 * the host always re-quotes before charging and never trusts UI prices. */
import { z } from 'zod';
import type { AppStoreState } from '../app/app-store';
import type { GameModule } from '../content/game-module';
import { VesselPurchaseApprovalSchema } from '../simulation/contracts/vessel-purchase';
import { inspectVesselOffer, VesselPurchaseIntentSchema } from '../simulation/features/vessel-purchase';
import { selectPlayerEntity, selectSelectedWorldTarget } from '../simulation/model/world-state';

export const VesselOfferViewSchema = z
  .object({
    intent: VesselPurchaseIntentSchema,
    approval: VesselPurchaseApprovalSchema.nullable(),
  })
  .strict()
  .readonly();
export type VesselOfferView = z.infer<typeof VesselOfferViewSchema>;

export function selectVesselOffers(state: AppStoreState, gameModule: GameModule): readonly VesselOfferView[] {
  const world = state.world;
  if (!world || world.status !== 'active' || !gameModule.rules.evaluateVesselPurchase) return Object.freeze([]);
  const player = selectPlayerEntity(world);
  const system = gameModule.definition.systems.find(system => system.id === player.location.systemId);
  const planet = world.entities.find(entity => entity.kind === 'planet');
  if (!system || !planet) return Object.freeze([]);
  const selected = selectSelectedWorldTarget(world);
  const station = selected?.kind === 'station' ? selected : null;
  const sources = [
    { stationEntityId: undefined, ids: system.planet.offeredEntityDefinitionIds },
    ...(station
      ? [
          {
            stationEntityId: station.id,
            ids: system.stations.find(row => row.id === station.stationId)?.shipOffers ?? [],
          },
        ]
      : []),
  ];
  return Object.freeze(
    sources.flatMap(source =>
      [...new Set(source.ids)].flatMap(id => {
        if (id === null || !gameModule.catalog.getShipDefinition(id)) return [];
        return [
          VesselOfferViewSchema.parse({
            intent: {
              sessionRevision: state.sessionRevision,
              playerDefinitionId: player.definitionId,
              systemId: system.id,
              planetEntityId: planet.id,
              ...(source.stationEntityId ? { stationEntityId: source.stationEntityId } : {}),
              vesselDefinitionId: id,
            },
            approval: inspectVesselOffer(world, gameModule, id, source.stationEntityId),
          }),
        ];
      })
    )
  );
}
