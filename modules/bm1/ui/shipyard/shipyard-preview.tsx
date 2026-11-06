/** Original planet ship preview. Navigation is transient; the host owns
 * readiness, payment, cargo preservation, launch and rollback. */
import type { ComponentProps } from 'react';
import type { GameModuleDefinition } from '@engine/content/schemas/game-module';
import type { VesselPurchaseIntent } from '@engine/simulation/features/vessel-purchase';
import type { VesselOfferView } from '@engine/ui/vessel-purchase-view';
import { HudGlyphField } from '../hud/hud-glyphs';
import { SourceControl } from '../source-control';
import { shipyardAsset, shipyardContent } from './shipyard-content';

export function shipyardPresentationAssets({ offer }: ComponentProps<typeof ShipyardPreview>) {
  const ship = shipyardContent.ships.find(ship => ship.definitionId === offer.intent.vesselDefinitionId);
  return [shipyardAsset(shipyardContent.panel), ...(ship ? [shipyardAsset(ship.asset)] : [])];
}

export function ShipyardPreview({
  offer,
  definition,
  busy,
  error,
  onExit,
  onPurchase,
}: {
  readonly offer: VesselOfferView;
  readonly definition: GameModuleDefinition;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onExit: () => void;
  readonly onPurchase: (intent: VesselPurchaseIntent) => void;
}) {
  const ship = definition.content.entityDefinitions.find(
    ship => ship.id === offer.intent.vesselDefinitionId && ship.category === 'ship'
  );
  const artwork = shipyardContent.ships.find(ship => ship.definitionId === offer.intent.vesselDefinitionId);
  if (!ship || ship.category !== 'ship' || !artwork) return null;
  const texts: Readonly<Record<string, string>> = {
    itemname: ship.name,
    price: offer.approval ? `${offer.approval.cost}` : '',
    itemdesc: error
      ? 'Purchase unavailable. Check cargo, standing and funds.'
      : `Hull: ${ship.maximumHull}\nShields: ${ship.maximumShields}\nPropulsion: ${ship.maximumSpeedPerFrame > 25 ? 'Warp Drive' : 'Impulse'}\nMass: ${ship.sizeClass * 1500} tons\nCargo Capacity: ${ship.cargoCapacity} tons\n`,
  };
  return (
    <>
      <svg
        className="bm1-hud-stage bm1-contact-stage"
        viewBox="0 0 600 450"
        width="600"
        height="450"
        aria-label="Ship purchase preview"
        data-contact-kind="planet"
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
              disabled={busy || c.offset === 83385}
              onActivate={() => (c.offset === 82801 ? onExit() : onPurchase(offer.intent))}
            />
          ))}
      </svg>
      {busy && (
        <p className="bm1-hud-accessible-notice" role="status">
          Preparing vessel launch...
        </p>
      )}
      {error && (
        <p className="bm1-hud-accessible-notice" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
