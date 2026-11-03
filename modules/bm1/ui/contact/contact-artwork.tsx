/** Source contact paint and authored control dispatch. The parent owns routing,
 * portal attachment, growth, keyboard listeners and opener/Exit focus lifetime. */
import type { Ref } from 'react';
import type { RepairView } from '../../../../src/ui/repair-view';
import type { PurchaseView } from '../../../../src/ui/purchase-view';
import type { ContactReadModel } from './contact-read-model';
import type { PurchaseHint } from './contact-controller';
import { contactAsset, CONTACT_EXIT_OFFSETS, CONTACT_BUY_OFFSET } from './contact-content';
import { HudGlyphField } from '../hud/hud-glyphs';
import { SourceControl } from '../source-control';
import { CONTACT_LAYOUT as layout } from './contact-layout';

export function ContactArtwork({ model, scale, offer, repair, exitRef, onClose, onPurchaseHint, onBeginRepair, onPurchaseCargo }: {
  readonly model: ContactReadModel;
  readonly scale: number;
  readonly offer: PurchaseView | null;
  readonly repair: RepairView;
  readonly exitRef: Ref<SVGGElement>;
  readonly onClose: () => void;
  readonly onPurchaseHint: (hint: PurchaseHint) => void;
  readonly onBeginRepair: () => void;
  readonly onPurchaseCargo: (quantityTons: number) => void;
}) {
  const exitOffset = CONTACT_EXIT_OFFSETS[model.plane.id];
  const labels: Readonly<Record<number, string>> = { 33180: 'Sell goods', 34673: 'Buy goods', 38354: 'Sell', 40475: 'Trade', 42520: 'Repair ship', 43187: 'Buy deuranium', 43549: 'Buy antimatter' };
  // Quotes remain host-owned. This dispatch only requests the currently
  // displayed offer; the command revalidates stock, payment and merchant identity.
  const activate = (offset: number) => {
    if (offset === CONTACT_BUY_OFFSET) {
      if (offer?.canPurchaseStock) onPurchaseCargo(offer.stockTons);
      return;
    }
    if (offset === 42520) onBeginRepair();
    onClose();
  };
  const purchaseHint = (offset: number, hint: PurchaseHint) => {
    if (offset !== CONTACT_BUY_OFFSET || !offer) return;
    onPurchaseHint(hint);
  };
  return <svg className="bm1-hud-stage bm1-contact-stage" viewBox={`0 0 ${layout.stageWidth} ${layout.stageHeight}`} width={layout.stageWidth} height={layout.stageHeight}
      aria-label="Communication panel" data-contact-kind={model.kind} data-contact-id={model.id} data-contact-scale={scale}>
      <g transform={`translate(${layout.parentX} ${layout.parentY}) scale(${scale / layout.maximumScale}) translate(${-layout.parentX} ${-layout.parentY})`}>
        {/* Authored zero-alpha blockers remain hit regions; transparent empty
            overlay space outside them remains available for world selection. */}
        {model.plane.controls.filter(c => c.layer === 1).map(c => <rect key={c.offset} x={c.left} y={c.top} width={c.right-c.left} height={c.bottom-c.top}
          className="bm1-contact-blocker" fill="transparent" data-contact-blocker={c.offset} />)}
        <image href={contactAsset(model.plane.asset)} width={layout.stageWidth} height={layout.stageHeight} />
        {model.asset && <image href={contactAsset(model.asset)} width={layout.stageWidth} height={layout.stageHeight} />}
        {model.plane.fields.map(({ field, transform }) => <g key={field.offset} transform={`matrix(${transform.join(' ')})`}><HudGlyphField field={field} text={model.texts[field.variable] ?? ''} /></g>)}
        {model.plane.controls.filter(c => c.layer !== 1).map(c => {
          const isExit = c.offset === exitOffset;
          const canRepair = c.offset === 42520 && repair.cost !== null && !repair.repairing;
          const canPurchase = c.offset === CONTACT_BUY_OFFSET && Boolean(offer?.canPurchaseStock);
          return <g key={c.offset} ref={isExit ? exitRef : undefined}
          onPointerEnter={() => purchaseHint(c.offset, 'offer')}
          onPointerLeave={() => purchaseHint(c.offset, 'busy')}
          onFocus={() => purchaseHint(c.offset, 'offer')}
          onBlur={() => purchaseHint(c.offset, 'busy')}>
          <SourceControl control={{ scriptOffset: c.offset + 88, name: '', depth: c.layer, artwork: null,
            paths: [`M${c.left},${c.top} H${c.right} V${c.bottom} H${c.left} Z`] }}
            label={isExit ? 'Exit communication' : labels[c.offset] ?? 'Unavailable contact control'}
            disabled={!isExit && !canRepair && !canPurchase}
            onActivate={() => activate(c.offset)} />
        </g>;
        })}
      </g>
    </svg>;
}
