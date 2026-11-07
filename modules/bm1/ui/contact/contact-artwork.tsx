/** Source contact paint and authored control dispatch. The parent owns routing,
 * portal attachment, growth, keyboard listeners and opener/Exit focus lifetime. */
import { useState } from 'react';
import type { Ref } from 'react';
import type { GameModuleDefinition } from '@engine/content/schemas/game-module';
import type { ResourcePurchaseIntent, ResourcePurchaseResult } from '@engine/simulation/contracts/resource-purchase';
import type { EquipmentIntent } from '@engine/simulation/features/equipment';
import type { CargoTradeIntent, CargoTradeRefusal } from '@engine/simulation/model/cargo-transactions';
import type { CommodityMarketView } from '@engine/ui/cargo-trade-view';
import type { EquipmentView } from '@engine/ui/equipment-view';
import type { PurchaseView } from '@engine/ui/purchase-view';
import type { RepairView } from '@engine/ui/repair-view';
import type { VesselOfferView } from '@engine/ui/vessel-purchase-view';
import { commerceAsset, commerceHitPath, commerceIcon } from '../commerce/commerce-content';
import { cargoTradeRefusalMessage } from '../commerce/trade-feedback';
import { equipmentContent, sourceMatrix } from '../equipment/equipment-content';
import { EquipmentStationOffers } from '../equipment/equipment-station-offers';
import { HudGlyphField } from '../hud/hud-glyphs';
import { shipyardAsset, shipyardContent } from '../shipyard/shipyard-content';
import { SourceControl } from '../source-control';
import { CONTACT_BUY_OFFSET, CONTACT_EXIT_OFFSETS, contactAsset } from './contact-content';
import type { PurchaseHint } from './contact-controller';
import { CONTACT_LAYOUT as layout } from './contact-layout';
import type { ContactReadModel } from './contact-read-model';

/**
 * Planet listing rollover text from source `rolloveritem(buytype)` (Symbol3:93518):
 * itemname = `<name> - <price + priceadjust> bars`, itemdesc = the item description.
 * `marketAdjustment` is the runtime's sampled `_root.priceadjust` for this system
 * entry (latinum). The source rollover has no Empire/deuranium branch, unlike the
 * station equipment rollover, so none is added here. The displayed list price is
 * informational: the authoritative self trade-in charge remains the host quote.
 * Returns null when the module definition is unavailable or the id is not a ship.
 */
export function planetListingRollover(
  definition: GameModuleDefinition | undefined,
  vesselDefinitionId: number,
  marketAdjustment: number
): { readonly name: string; readonly description: string } | null {
  const ship = definition?.content.entityDefinitions.find(
    entity => entity.id === vesselDefinitionId && entity.category === 'ship'
  );
  if (!ship) return null;
  return { name: `${ship.name} - ${ship.basePrice + marketAdjustment} bars`, description: ship.description };
}

export function ContactArtwork({
  model,
  scale,
  offer,
  repair,
  exitRef,
  onClose,
  onPurchaseHint,
  onBeginRepair,
  onPurchaseCargo,
  shipOffers,
  onPreviewShip,
  equipment,
  definition,
  onEquipmentCommand,
  onOpenEquipmentSale,
  commodityMarket,
  onCargoTrade,
  onTradeHint,
  onOpenMerchant,
  onPurchaseResource,
}: {
  readonly onPurchaseResource?: ((intent: ResourcePurchaseIntent) => ResourcePurchaseResult | null) | undefined;
  readonly commodityMarket?: CommodityMarketView | null;
  readonly onCargoTrade?: ((intent: CargoTradeIntent) => CargoTradeRefusal | null) | undefined;
  readonly onTradeHint?: ((text: string) => void) | undefined;
  readonly onOpenMerchant?: (() => void) | undefined;
  readonly equipment?: EquipmentView | null | undefined;
  readonly definition?: GameModuleDefinition | undefined;
  readonly onEquipmentCommand?: ((intent: EquipmentIntent) => void) | undefined;
  readonly onOpenEquipmentSale?: (() => void) | undefined;
  readonly model: ContactReadModel;
  readonly scale: number;
  readonly offer: PurchaseView | null;
  readonly repair: RepairView;
  readonly exitRef: Ref<SVGGElement>;
  readonly onClose: () => void;
  readonly onPurchaseHint: (hint: PurchaseHint) => void;
  readonly onBeginRepair: () => void;
  readonly onPurchaseCargo: (quantityTons: number) => void;
  /** Six original listing slots, including empty/non-vessel positions. */
  readonly shipOffers: readonly (VesselOfferView | null)[];
  readonly onPreviewShip: (definitionId: number) => void;
}) {
  const [equipmentHint, setEquipmentHint] = useState({ name: '', description: '' });
  const exitOffset = CONTACT_EXIT_OFFSETS[model.plane.id];
  const demand = commodityMarket?.rows.find(row => row.sell !== null);
  const station = definition?.systems
    .find(system => system.id === commodityMarket?.systemId)
    ?.stations.find(station => station.id === commodityMarket?.stationId);
  const labels: Readonly<Record<number, string>> = {
    33180: 'Sell goods',
    34673: 'Buy goods',
    38354: 'Sell',
    40475: 'Trade',
    42520: 'Repair ship',
    43187: 'Buy antimatter',
    43549: 'Buy deuranium',
  };
  // Quotes remain host-owned. This dispatch only requests the currently
  // displayed offer; the command revalidates stock, payment and merchant identity.
  const activate = (offset: number) => {
    if ((offset === 43187 || offset === 43549) && onPurchaseResource) {
      const result = onPurchaseResource({ resourceId: offset === 43187 ? 'antimatter' : 'deuranium' });
      if (result?.description) setEquipmentHint(current => ({ ...current, description: result.description! }));
      if (result?.notice) onTradeHint?.('');
      return;
    }
    if (offset === 33180 && demand?.sell && onCargoTrade) {
      const refusal = onCargoTrade(demand.sell.intent);
      if (refusal === null) {
        onTradeHint?.('');
        onClose();
        return;
      }
      // A ship with no matching pod keeps its communication panel in source.
      if (refusal !== 'positions') onTradeHint?.(cargoTradeRefusalMessage(refusal));
      return;
    }
    if (offset === 38354 && onOpenEquipmentSale) {
      onOpenEquipmentSale();
      return;
    }
    if (offset === CONTACT_BUY_OFFSET) {
      if (offer?.canPurchaseStock) onPurchaseCargo(offer.stockTons);
      return;
    }
    if (offset === 42520) onBeginRepair();
    onClose();
  };
  const purchaseHint = (offset: number, hint: PurchaseHint) => {
    if (offset === 43187 || offset === 43549) {
      // The original button bodies are named in reverse order to the resource
      // scripts: 43275 buys antimatter; 43637 buys deuranium. Use script evidence.
      const antimatter = offset === 43187;
      setEquipmentHint(
        hint === 'offer'
          ? {
              name: antimatter ? '(Anti)Matter - 3 bars per unit' : 'Deuranium - 1 bar per unit',
              description: antimatter
                ? 'Required for warp travel. Fills your ship to capacity.'
                : 'Required to build stations and starships. Sells in packages of 1000 units only.',
            }
          : { name: '', description: '' }
      );
      return;
    }
    if (offset === 33180 && demand) {
      onPurchaseHint(hint === 'offer' ? 'demand' : hint);
      return;
    }
    if (offset !== CONTACT_BUY_OFFSET || !offer) return;
    onPurchaseHint(hint);
  };
  return (
    <svg
      className="bm1-hud-stage bm1-contact-stage"
      viewBox={`0 0 ${layout.stageWidth} ${layout.stageHeight}`}
      width={layout.stageWidth}
      height={layout.stageHeight}
      aria-label="Communication panel"
      data-contact-kind={model.kind}
      data-contact-id={model.id}
      data-contact-scale={scale}
    >
      <g
        transform={`translate(${layout.parentX} ${layout.parentY}) scale(${scale / layout.maximumScale}) translate(${-layout.parentX} ${-layout.parentY})`}
      >
        {/* Authored zero-alpha blockers remain hit regions; transparent empty
            overlay space outside them remains available for world selection. */}
        {model.plane.controls
          .filter(c => c.layer === 1)
          .map(c => (
            <rect
              key={c.offset}
              x={c.left}
              y={c.top}
              width={c.right - c.left}
              height={c.bottom - c.top}
              className="bm1-contact-blocker"
              fill="transparent"
              data-contact-blocker={c.offset}
            />
          ))}
        <image href={contactAsset(model.plane.asset)} width={layout.stageWidth} height={layout.stageHeight} />
        {model.asset && (
          <image href={contactAsset(model.asset)} width={layout.stageWidth} height={layout.stageHeight} />
        )}
        {model.plane.fields.map(({ field, transform }) => (
          <g key={field.offset} transform={`matrix(${transform.join(' ')})`}>
            <HudGlyphField
              field={field}
              text={
                field.variable === 'itemname' && equipmentHint.name
                  ? equipmentHint.name
                  : field.variable === 'itemdesc' && equipmentHint.description
                    ? equipmentHint.description
                    : (model.texts[field.variable] ?? '')
              }
            />
          </g>
        ))}
        {model.plane.controls
          .filter(c => c.layer !== 1)
          .map(c => {
            const isExit = c.offset === exitOffset;
            const canRepair = c.offset === 42520 && repair.cost !== null && !repair.repairing;
            const canPurchase = c.offset === CONTACT_BUY_OFFSET && Boolean(offer?.canPurchaseStock);
            return (
              <g
                key={c.offset}
                ref={isExit ? exitRef : undefined}
                onPointerEnter={() => purchaseHint(c.offset, 'offer')}
                onPointerLeave={() => purchaseHint(c.offset, 'busy')}
                onFocus={() => purchaseHint(c.offset, 'offer')}
                onBlur={() => purchaseHint(c.offset, 'busy')}
              >
                <SourceControl
                  control={{
                    scriptOffset: c.offset + 88,
                    name: '',
                    depth: c.layer,
                    artwork: null,
                    paths: [`M${c.left},${c.top} H${c.right} V${c.bottom} H${c.left} Z`],
                  }}
                  label={isExit ? 'Exit communication' : (labels[c.offset] ?? 'Unavailable contact control')}
                  disabled={
                    !isExit &&
                    !canRepair &&
                    !canPurchase &&
                    !((c.offset === 43187 || c.offset === 43549) && onPurchaseResource) &&
                    !(c.offset === 38354 && onOpenEquipmentSale) &&
                    !(c.offset === 33180 && demand?.sell && onCargoTrade)
                  }
                  onActivate={() => activate(c.offset)}
                />
              </g>
            );
          })}
        {model.kind === 'station' && equipment?.stationEntityId === model.id && definition && onEquipmentCommand && (
          <EquipmentStationOffers
            view={equipment}
            definition={definition}
            onHint={(name, description) => setEquipmentHint({ name, description })}
            onCommand={onEquipmentCommand}
          />
        )}
        {model.kind === 'station' &&
          commodityMarket?.kind === 'station' &&
          onOpenMerchant &&
          equipmentContent.stationSlots
            .filter(slot => station?.commodityMarketSlots?.includes(slot.index))
            .map(slot => (
              <g
                key={`commodity-${slot.index}`}
                transform={`translate(303 110) ${sourceMatrix(slot.matrix)}`}
                onPointerEnter={() => setEquipmentHint({ name: 'Buy and sell goods', description: '' })}
                onPointerLeave={() => setEquipmentHint({ name: '', description: '' })}
              >
                <image href={commerceAsset(commerceIcon(105).file)} x={-100} y={-100} width={200} height={200} />
                <SourceControl
                  control={{
                    scriptOffset: slot.offset + 88,
                    name: `item${slot.index + 1}`,
                    depth: 3,
                    artwork: null,
                    paths: [commerceHitPath(105)],
                  }}
                  label="Buy and sell goods"
                  onActivate={onOpenMerchant}
                />
              </g>
            ))}
        {model.kind === 'planet' &&
          shipyardContent.listingSlots.map(slot => {
            const offer = shipOffers[slot.slot];
            const ship = shipyardContent.ships.find(ship => ship.definitionId === offer?.intent.vesselDefinitionId);
            if (!offer || !ship) return null;
            const b = ship.bounds;
            const rollover = planetListingRollover(definition, ship.definitionId, equipment?.marketAdjustment ?? 0);
            const clearRollover = () => setEquipmentHint({ name: '', description: '' });
            // Symbol7's movie-clip release uses its displayed extent. Reuse the
            // recovered vector/bitmap union, transformed into this named slot.
            // Source item1–6 (Symbol3:38685…) roll over regardless of prestige or
            // funds, so hover is not gated by `offer.approval`; rollout clears both.
            return (
              <g
                key={slot.slot}
                transform={`matrix(${slot.transform.join(' ')})`}
                data-listing-slot={slot.slot}
                onPointerEnter={() => rollover && setEquipmentHint(rollover)}
                onPointerLeave={clearRollover}
                onFocus={() => rollover && setEquipmentHint(rollover)}
                onBlur={clearRollover}
              >
                <image href={shipyardAsset(ship.asset)} width="600" height="450" />
                <SourceControl
                  control={{
                    scriptOffset: slot.offset + 88,
                    name: `item${slot.slot + 1}`,
                    depth: 3,
                    artwork: null,
                    paths: [`M${b.left},${b.top} H${b.right} V${b.bottom} H${b.left} Z`],
                  }}
                  label={`Inspect vessel ${ship.definitionId}`}
                  disabled={!offer.approval}
                  onActivate={() => onPreviewShip(ship.definitionId)}
                />
              </g>
            );
          })}
      </g>
    </svg>
  );
}
