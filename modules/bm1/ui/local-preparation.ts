/**
 * Artwork every local interaction in one system can show, prepared before the
 * scene is revealed and during the departure hold for the destination.
 *
 * Loaded lazily (see panel-loaders.ts): importing this module also loads the
 * panel code it projects from, which is exactly the code preparation a system
 * needs. Every path comes from a panel's own projection, so the prepared set
 * cannot drift from what that panel displays.
 *
 * Scope is bounded to one system: its planet and stations, the NPC ships
 * currently present, the planet's ship listing, its stations' equipment offers
 * and the player's own sale/navigation ink. NPCs that appear later reconcile
 * through the same set; only their tactical portrait waits, never the HUD.
 */
import type { PixiSceneDefinition } from '@engine/rendering/pixi/configuration';
import type { EquipmentView } from '@engine/ui/equipment-view';
import type { FleetView } from '@engine/ui/fleet-view';
import { merchantArtworkAssets } from './commerce/merchant-panel';
import { communicationArtworkAssets } from './communication/communication-presentation';
import { contactSceneAssets } from './contact/contact-presentation';
import { equipmentSaleViewAssets } from './equipment/equipment-sale';
import { repairArtworkAssets } from './repair/repair-presentation';
import { shipyardVesselAssets } from './shipyard/shipyard-preview';
import { tacticalDefinitionAssets } from './tactical/tactical-content';
import { navigationVesselAssets } from './travel/navigation-panels';

export interface LocalPreparationInput {
  readonly fleet?: FleetView | null | undefined;
  readonly definition: PixiSceneDefinition;
  readonly systemId: number;
  readonly playerDefinitionId: number;
  /** NPC ship definitions currently in the system (none for a destination). */
  readonly npcDefinitionIds: readonly number[];
  readonly equipment: EquipmentView | null;
}

export function localInteractionAssets({
  fleet,
  definition,
  systemId,
  playerDefinitionId,
  npcDefinitionIds,
  equipment,
}: LocalPreparationInput): readonly string[] {
  const system = definition.systems.find(candidate => candidate.id === systemId);
  const stations = system?.stations ?? [];
  const stationDefinitionIds = stations.map(station => station.structureDefinitionId);
  const equipmentOfferIds = [
    ...stations.flatMap(station => station.equipmentOffers ?? []),
    ...(equipment?.offers.map(offer => offer.weaponDefinitionId) ?? []),
  ];
  return [
    ...new Set([
      ...contactSceneAssets({
        definition,
        systemId,
        stationDefinitionIds,
        equipmentOfferIds,
        stationMarket: stations.some(station => (station.commodityMarketSlots?.length ?? 0) > 0),
      }),
      ...[...stationDefinitionIds, ...npcDefinitionIds].flatMap(tacticalDefinitionAssets),
      ...merchantArtworkAssets(),
      ...(system?.planet.offeredEntityDefinitionIds ?? []).flatMap(id => (id === null ? [] : shipyardVesselAssets(id))),
      ...(equipment ? equipmentSaleViewAssets(equipment, fleet) : []),
      ...navigationVesselAssets(playerDefinitionId),
      ...communicationArtworkAssets(),
      ...repairArtworkAssets(),
    ]),
  ];
}
