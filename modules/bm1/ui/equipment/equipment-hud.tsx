/** Original owned icons and slot-assignment controls in the expanded HUD.
 * The enclosing HUD owns its source parent motion; top equipped icons are root
 * Page1 graphics and are rendered separately without that translation. */
import type { EquipmentIntent } from '@engine/simulation/features/equipment';
import type { EquipmentView } from '@engine/ui/equipment-view';
import { SourceControl } from '../source-control';
import { equipmentContent, equipmentHitPath, sourceMatrix } from './equipment-content';
import { EquipmentIcon } from './equipment-icon';

export function EquipmentHud({
  view,
  channel,
  onCommand,
}: {
  readonly view: EquipmentView;
  readonly channel: 0 | 1 | 2;
  readonly onCommand: (intent: EquipmentIntent) => void;
}) {
  return (
    <g transform="translate(300 282)" data-equipment-inventory>
      {equipmentContent.owned.map(slot => {
        const item = view.owned[slot.index];
        if (!item?.weaponDefinitionId) return null;
        return (
          <g key={slot.index} transform={sourceMatrix(slot.matrix)}>
            <EquipmentIcon weaponId={item.weaponDefinitionId} />
            <SourceControl
              control={{
                scriptOffset: slot.offset + 88,
                name: `item${slot.index + 1}`,
                depth: 3,
                artwork: null,
                paths: [equipmentHitPath(item.weaponDefinitionId)],
              }}
              label={`Load equipment ${slot.index + 1} into slot ${channel + 1}`}
              onActivate={() => onCommand(item.loadIntents[channel]!)}
            />
          </g>
        );
      })}
    </g>
  );
}
export function EquippedIcons({ view }: { readonly view: EquipmentView }) {
  return (
    <>
      {equipmentContent.equipped.map(slot => (
        <g key={slot.channel} transform={sourceMatrix(slot.matrix)} data-equipped-slot={slot.channel + 1}>
          <EquipmentIcon weaponId={view.channels[slot.channel]?.weaponDefinitionId ?? null} />
        </g>
      ))}
    </>
  );
}
