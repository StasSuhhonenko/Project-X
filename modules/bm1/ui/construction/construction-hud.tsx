/** Nine original item receivers, including the deliberately empty selector100. */
import type { ConstructionView } from '@engine/ui/construction-view';
import { equipmentContent, sourceMatrix } from '../equipment/equipment-content';
import { SourceControl } from '../source-control';
import { constructionAsset, hitPath, planIcon } from './construction-content';

export function ConstructionHud({
  view,
  onOpen,
  onDelete,
  onHint,
}: {
  readonly view: ConstructionView;
  readonly onOpen: (index: number) => void;
  readonly onDelete: (index: number) => boolean;
  readonly onHint: (message: string) => void;
}) {
  return (
    <g transform="translate(300 282)" data-construction-inventory>
      {equipmentContent.owned.map(slot => {
        const plan = view.plans[slot.index];
        const icon = planIcon(plan?.structureDefinitionId ?? null);
        const hover = () =>
          onHint(plan ? 'Build a ' + plan.name + ' at this location. Shift-Click to delete this plan.' : '');
        return (
          <g
            key={slot.index}
            transform={sourceMatrix(slot.matrix)}
            data-plan-slot={slot.index}
            data-selector-frame={icon.id}
            onPointerEnter={hover}
            onPointerLeave={() => onHint('')}
            onFocus={hover}
            onBlur={() => onHint('')}
          >
            <image href={constructionAsset(icon.file)} x={-100} y={-100} width={200} height={200} />
            {plan && (
              <SourceControl
                control={{
                  scriptOffset: slot.offset + 88,
                  name: 'item' + (slot.index + 1),
                  depth: 3,
                  artwork: null,
                  paths: [hitPath(icon.hitBounds)],
                }}
                label={'Build a ' + plan.name}
                onActivate={({ shiftKey }) => {
                  if (shiftKey) {
                    if (onDelete(slot.index)) onHint('Station plan deleted...');
                    return;
                  }
                  onOpen(slot.index);
                }}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}
