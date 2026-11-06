/** Original held type19 rows. Economics come from live immutable assessments;
 * this component owns only authored ink, focus, dismissal and intent routing. */
import { useEffect, useRef, type ComponentProps } from 'react';
import { eventHasUiInputOwner } from '@engine/platform/keyboard/ui-input-ownership';
import type { CargoTradeIntent, CargoTradeRefusal } from '@engine/simulation/model/cargo-transactions';
import type { CommodityMarketView } from '@engine/ui/cargo-trade-view';
import { HudGlyphField } from '../hud/hud-glyphs';
import { SourceControl } from '../source-control';
import { commerceAsset, commerceContent } from './commerce-content';
import { cargoTradeRefusalMessage } from './trade-feedback';

export function MerchantPanel({
  market,
  scale,
  onTrade,
  onClose,
  onHint,
}: {
  readonly market: CommodityMarketView;
  readonly scale: number;
  readonly onTrade: (intent: CargoTradeIntent) => CargoTradeRefusal | null;
  readonly onClose: () => void;
  readonly onHint: (text: string) => void;
}) {
  const close = useRef<SVGGElement>(null);
  useEffect(() => {
    close.current?.querySelector<SVGGElement>('[role=button]')?.focus();
    const down = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.key.toLowerCase() !== 'q')
        return;
      const own = event.target instanceof Element && event.target.closest('[data-commodity-market]');
      if (eventHasUiInputOwner(event) && !own) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [onClose]);
  const text = [
    'Price/ton            Item',
    ...market.rows.map(row => `${row.pricePerTon}               ${row.label}`),
  ].join('\n');
  return (
    <svg
      className="bm1-hud-stage bm1-contact-stage"
      viewBox="0 0 600 450"
      width={600}
      height={450}
      data-commodity-market={market.merchantEntityId}
      data-contact-kind="station"
      aria-label="Commodity merchant"
    >
      <g transform={`translate(303 110) scale(${scale / 100}) translate(-303 -110)`}>
        {commerceContent.controls
          .filter(c => c.action === 'block')
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
        <image href={commerceAsset(commerceContent.panel)} width={600} height={450} />
        {commerceContent.fields.map(({ field, transform }) => (
          <g key={field.offset} transform={`matrix(${transform.join(' ')})`}>
            <HudGlyphField field={field} text={text} />
          </g>
        ))}
        {commerceContent.controls
          .filter(c => c.action !== 'block')
          .map(control => {
            const row = market.rows[control.row],
              action = control.action === 'buy' ? row?.buy : row?.sell;
            const closing = control.action === 'close';
            return (
              <g key={control.offset} ref={closing ? close : undefined}>
                <SourceControl
                  control={{
                    scriptOffset: control.offset + 88,
                    name: '',
                    depth: control.layer,
                    artwork: null,
                    paths: [`M${control.left},${control.top} H${control.right} V${control.bottom} H${control.left} Z`],
                  }}
                  label={
                    closing
                      ? 'Close commodity merchant'
                      : `${control.action === 'buy' ? 'Buy' : 'Sell'} commodity ${control.row + 1}`
                  }
                  disabled={!closing && !action}
                  onActivate={() => {
                    if (closing) {
                      onClose();
                      return;
                    }
                    if (!action) return;
                    const refusal = onTrade(action.intent);
                    onHint(
                      control.action === 'sell' && refusal === 'positions' ? '' : cargoTradeRefusalMessage(refusal)
                    );
                  }}
                />
              </g>
            );
          })}
      </g>
    </svg>
  );
}
export const merchantPanelAssets = (_props: ComponentProps<typeof MerchantPanel>) => [
  commerceAsset(commerceContent.panel),
];
