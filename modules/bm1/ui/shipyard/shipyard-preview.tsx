/** Shared type21/type23 ship preview. Station type23 currently reuses
 * the recovered planet panel (Symbol117) in place of unrecovered Symbol172. Navigation is transient; the host owns
 * readiness, payment, cargo preservation, launch and rollback. */
import type { ComponentProps } from 'react';
import { useState } from 'react';
import type { GameModuleDefinition } from '@engine/content/schemas/game-module';
import type { FleetAcquisitionIntent } from '@engine/simulation/features/fleet';
import type { VesselPurchaseIntent } from '@engine/simulation/features/vessel-purchase';
import type { FleetView } from '@engine/ui/fleet-view';
import type { VesselOfferView } from '@engine/ui/vessel-purchase-view';
import { HudGlyphField } from '../hud/hud-glyphs';
import { SourceControl } from '../source-control';
import { shipyardAsset, shipyardContent } from './shipyard-content';

/** Panel ink plus one offered vessel's portrait; shared with local preparation. */
export function shipyardVesselAssets(vesselDefinitionId: number) {
  const ship = shipyardContent.ships.find(ship => ship.definitionId === vesselDefinitionId);
  return [shipyardAsset(shipyardContent.panel), ...(ship ? [shipyardAsset(ship.asset)] : [])];
}
export function shipyardPresentationAssets({ offer }: ComponentProps<typeof ShipyardPreview>) {
  return shipyardVesselAssets(offer.intent.vesselDefinitionId);
}

export function ShipyardPreview({
  offer,
  definition,
  busy,
  error,
  onExit,
  onPurchase,
  fleet,
  fleetBusy = false,
  fleetMessage,
  onAcquireFleetShip,
}: {
  readonly offer: VesselOfferView;
  readonly definition: GameModuleDefinition;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onExit: () => void;
  readonly onPurchase: (intent: VesselPurchaseIntent) => void;
  readonly fleet?: FleetView | null | undefined;
  readonly fleetBusy?: boolean | undefined;
  readonly fleetMessage?: string | null | undefined;
  readonly onAcquireFleetShip?: ((intent: FleetAcquisitionIntent) => void) | undefined;
}) {
  const [priceCommand, setPriceCommand] = useState<'self' | 'fleet'>('self');
  const [fleetAttempted, setFleetAttempted] = useState(false);
  // Symbol-3-83473.as:1-66: Fleet has its own quote and command. Join the
  // complete source identity so another station's same hull cannot supply it.
  const fleetOffer = fleet?.acquisitionOffers.find(
    ({ intent }) =>
      intent.systemId === offer.intent.systemId &&
      intent.planetEntityId === offer.intent.planetEntityId &&
      intent.stationEntityId === offer.intent.stationEntityId &&
      intent.vesselDefinitionId === offer.intent.vesselDefinitionId
  );
  const refusal = fleetAttempted ? fleetMessage || fleetOffer?.decision?.refusal : null;
  const ship = definition.content.entityDefinitions.find(
    ship => ship.id === offer.intent.vesselDefinitionId && ship.category === 'ship'
  );
  const artwork = shipyardContent.ships.find(ship => ship.definitionId === offer.intent.vesselDefinitionId);
  if (!ship || ship.category !== 'ship' || !artwork) return null;
  const texts: Readonly<Record<string, string>> = {
    itemname: ship.name,
    price:
      priceCommand === 'fleet'
        ? `${fleetOffer?.decision?.price.amount ?? ''}`
        : offer.approval
          ? `${offer.approval.cost}`
          : '',
    itemdesc:
      refusal ||
      (error
        ? 'Purchase unavailable. Check cargo, standing and funds.'
        : `Hull: ${ship.maximumHull}\nShields: ${ship.maximumShields}\nPropulsion: ${ship.maximumSpeedPerFrame > 25 ? 'Warp Drive' : 'Impulse'}\nMass: ${ship.sizeClass * 1500} tons\nCargo Capacity: ${ship.cargoCapacity} tons\n`),
  };
  return (
    <>
      <svg
        className="bm1-hud-stage bm1-contact-stage"
        viewBox="0 0 600 450"
        width="600"
        height="450"
        aria-label="Ship purchase preview"
        data-contact-kind={offer.intent.stationEntityId ? 'station' : 'planet'}
        data-source-preview-type={offer.intent.stationEntityId ? 23 : 21}
        data-panel-adaptation={offer.intent.stationEntityId ? 'planet-symbol117-for-station-symbol172' : undefined}
        data-vessel-preview={ship.id}
      >
        {shipyardContent.controls
          .filter(c => c.layer === 1)
          .map(c => (
            <rect
              key={c.offset}
              x={c.left}
              y={c.top}
              width={c.right - c.left}
              height={c.bottom - c.top}
              fill="transparent"
              className="bm1-contact-blocker"
            />
          ))}
        <image href={shipyardAsset(shipyardContent.panel)} width="600" height="450" />
        <image href={shipyardAsset(artwork.asset)} width="600" height="450" />
        {shipyardContent.fields.map(({ field, transform }) => (
          <g key={field.offset} transform={`matrix(${transform.join(' ')})`}>
            <HudGlyphField field={field} text={texts[field.variable] ?? ''} />
          </g>
        ))}
        {shipyardContent.controls
          .filter(c => c.layer !== 1)
          .map(c => (
            <g
              key={c.offset}
              onPointerEnter={() => {
                if (c.offset === 83385 || c.offset === 85723) setPriceCommand(c.offset === 83385 ? 'fleet' : 'self');
              }}
              onFocus={() => {
                if (c.offset === 83385 || c.offset === 85723) setPriceCommand(c.offset === 83385 ? 'fleet' : 'self');
              }}
            >
              <SourceControl
                key={c.offset}
                control={{
                  scriptOffset: c.offset + 88,
                  name: '',
                  depth: c.layer,
                  artwork: null,
                  paths: [`M${c.left},${c.top} H${c.right} V${c.bottom} H${c.left} Z`],
                }}
                label={
                  c.offset === 82801
                    ? 'Exit ship preview'
                    : c.offset === 85723
                      ? 'Buy ship for self'
                      : 'Buy ship for fleet'
                }
                disabled={busy || fleetBusy || (c.offset === 83385 && (!fleetOffer?.decision || !onAcquireFleetShip))}
                onActivate={() => {
                  if (c.offset === 82801) {
                    onExit();
                    return;
                  }
                  if (c.offset === 83385) {
                    if (!fleetOffer?.decision) return;
                    setFleetAttempted(true);
                    onAcquireFleetShip?.(fleetOffer.intent);
                    return;
                  }
                  setFleetAttempted(false);
                  onPurchase(offer.intent);
                }}
              />
            </g>
          ))}
      </svg>
      {(busy || fleetBusy) && (
        <p className="bm1-hud-accessible-notice" role="status">
          Preparing vessel launch...
        </p>
      )}
      {error && (
        <p className="bm1-hud-accessible-notice" role="alert">
          {error}
        </p>
      )}
      {refusal && (
        <p className="bm1-hud-accessible-notice" role="alert">
          {refusal}
        </p>
      )}
    </>
  );
}
