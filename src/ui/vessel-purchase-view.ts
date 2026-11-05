/** Display-only planet offers. Nullable approval means currently unavailable;
 * the host always re-quotes before charging and never trusts UI prices. */
import { z } from 'zod';
import type { AppStoreState } from '../app/app-store';
import type { GameModule } from '../content/game-module';
import { inspectVesselOffer, VesselPurchaseIntentSchema } from '../simulation/features/vessel-purchase';
import { VesselPurchaseApprovalSchema } from '../simulation/contracts/vessel-purchase';
import { selectPlayerEntity } from '../simulation/model/world-state';

export const VesselOfferViewSchema = z.object({
  intent: VesselPurchaseIntentSchema,
  approval: VesselPurchaseApprovalSchema.nullable(),
}).strict().readonly();
export type VesselOfferView = z.infer<typeof VesselOfferViewSchema>;

export function selectVesselOffers(state: AppStoreState, gameModule: GameModule): readonly VesselOfferView[] {
  const world = state.world;
  if (!world || world.status !== 'active' || !gameModule.rules.evaluateVesselPurchase) return Object.freeze([]);
  const player = selectPlayerEntity(world);
  const system = gameModule.definition.systems.find(system => system.id === player.location.systemId);
  const planet = world.entities.find(entity => entity.kind === 'planet');
  if (!system || !planet) return Object.freeze([]);
  return Object.freeze([...new Set(system.planet.offeredEntityDefinitionIds)].flatMap(id => {
    if (id === null || !gameModule.catalog.getShipDefinition(id)) return [];
    return [VesselOfferViewSchema.parse({ intent: {
      sessionRevision: state.sessionRevision, playerDefinitionId: player.definitionId,
      systemId: system.id, planetEntityId: planet.id, vesselDefinitionId: id,
    }, approval: inspectVesselOffer(world, gameModule, id) })];
  }));
}
