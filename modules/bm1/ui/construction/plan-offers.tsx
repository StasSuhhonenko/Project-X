/** Source-positioned station plans. Refused purchases deliberately produce no UI change. */
import type { ConstructionView } from '@engine/ui/construction-view';
import type { GameplayPresentationProps } from '../../presentation-contract';
import { equipmentContent, sourceMatrix } from '../equipment/equipment-content';
import { SourceControl } from '../source-control';
import { constructionAsset, hitPath, planIcon } from './construction-content';

export interface ContactConstructionProps {
  readonly construction?: ConstructionView | null | undefined;
  readonly onPurchasePlan?: GameplayPresentationProps['onPurchasePlan'];
}
export function PlanOffers({
  construction,
  onPurchasePlan,
  onHint,
  onPurchased,
}: ContactConstructionProps & {
  readonly onHint: (name: string, description: string) => void;
  readonly onPurchased: () => void;
}) {
  if (!construction) return null;
  return (
    <>
      {equipmentContent.stationSlots.map(slot => {
        const offer = construction.offers[slot.index];
        if (!offer) return null;
        const icon = planIcon(offer.structureDefinitionId);
        // Symbol-3-99010.as:125-131 displays ore here, but :42-45 still debits latinum.
        const price =
          construction.governmentId === 16 ? `${offer.basePrice / 4} units of deuranium` : `${offer.price.amount} bars`;
        const hover = () => onHint(`${offer.name} - ${price}`, offer.description);
        const clear = () => onHint('', '');
        return (
          <g
            key={slot.index}
            transform={'translate(303 110) ' + sourceMatrix(slot.matrix)}
            data-plan-offer={slot.index}
            onPointerEnter={hover}
            onPointerLeave={clear}
            onFocus={hover}
            onBlur={clear}
          >
            <image href={constructionAsset(icon.file)} x={-100} y={-100} width={200} height={200} />
            <SourceControl
              control={{
                scriptOffset: slot.offset + 88,
                name: 'item' + (slot.index + 1),
                depth: 3,
                artwork: null,
                paths: [hitPath(icon.hitBounds)],
              }}
              label={'Buy station plan ' + offer.name}
              onActivate={() => {
                if (!onPurchasePlan?.(offer.purchaseIntent)) return;
                onPurchased();
              }}
            />
          </g>
        );
      })}
    </>
  );
}
