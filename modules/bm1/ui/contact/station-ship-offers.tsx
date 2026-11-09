/** Type-9 station Symbol7 selectors reuse the recovered C3 portraits.
 * Portrait SVGs contain the type-21 stage transform; undo it before applying
 * the station's authored selector matrix. Hit regions follow the same affine. */
import type { GameModuleDefinition } from '@engine/content/schemas/game-module';
import type { SystemStandingView } from '@engine/ui/system-standing-view';
import type { VesselOfferView } from '@engine/ui/vessel-purchase-view';
import { hasVesselPurchaseStanding } from '../../vessel-purchase';
import { equipmentContent, sourceMatrix } from '../equipment/equipment-content';
import { shipyardAsset, shipyardContent } from '../shipyard/shipyard-content';
import { SourceControl } from '../source-control';

export const STATION_SHIP_PRESTIGE_REFUSAL =
  'You inquire about this item, but several security guards rush in and stop the transaction. Apparently the government does not want you buying this.';

/** Source Symbol3:99010 inquiry gate. Standing is the C2 current-system view,
 * never a second reputation store. The host independently rechecks at commit. */
export function requestStationShipPreview(
  systemId: number,
  sizeClass: number,
  standing: SystemStandingView | null,
  open: () => void,
  refuse: (message: string) => void
): void {
  if (!standing || standing.systemId !== systemId || !hasVesselPurchaseStanding(sizeClass, standing.value)) {
    refuse(STATION_SHIP_PRESTIGE_REFUSAL);
    return;
  }
  open();
}

export function StationShipOffers({
  offers,
  onPreview,
  onHint,
  definition,
  marketAdjustment,
}: {
  readonly offers: readonly (VesselOfferView | null)[];
  readonly onPreview: (id: number) => void;
  readonly onHint: (name: string, description: string) => void;
  readonly definition?: GameModuleDefinition | undefined;
  readonly marketAdjustment: number;
}) {
  // COMMUNICATION_ARTWORK_RECOVERY.json previewInstance (Symbol3:82552).
  const previewScale = 70813 / 65536;
  return (
    <>
      {equipmentContent.stationSlots.map(slot => {
        const offer = offers[slot.index];
        const ship = shipyardContent.ships.find(ship => ship.definitionId === offer?.intent.vesselDefinitionId);
        const entity = definition?.content.entityDefinitions.find(entity => entity.id === ship?.definitionId);
        if (!offer || !ship || entity?.category !== 'ship') return null;
        const b = ship.bounds;
        const hint = () =>
          onHint(entity.name + ' - ' + (entity.basePrice + marketAdjustment) + ' bars', entity.description);
        const clear = () => onHint('', '');
        return (
          <g
            key={slot.index}
            transform={'translate(303 110) ' + sourceMatrix(slot.matrix)}
            data-station-ship-slot={slot.index}
            onPointerEnter={hint}
            onPointerLeave={clear}
            onFocus={hint}
            onBlur={clear}
          >
            <g transform={'scale(' + 1 / previewScale + ') translate(-226.35 -39.5)'}>
              <image href={shipyardAsset(ship.asset)} width="600" height="450" />
              <SourceControl
                control={{
                  scriptOffset: slot.offset + 88,
                  name: 'item' + (slot.index + 1),
                  depth: 3,
                  artwork: null,
                  paths: ['M' + b.left + ',' + b.top + ' H' + b.right + ' V' + b.bottom + ' H' + b.left + ' Z'],
                }}
                label={'Inspect vessel ' + ship.definitionId}
                onActivate={() => onPreview(ship.definitionId)}
              />
            </g>
          </g>
        );
      })}
    </>
  );
}
