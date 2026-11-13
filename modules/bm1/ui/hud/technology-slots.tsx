/** UI-12 statistics technology row.
 *
 * Source `Symbol-6-52531.as:81-89` walks `mytech[1..9]` and sets each
 * `item<i>:mytype` to `mytech[i] + 105`, or to the empty selector frame 100.
 * The port's owned technologies are the engine's ordered `technologyWeaponIds`
 * (appended on purchase), so technology `i` paints in slot `i`. Frame `id+105`
 * is the same Symbol7 selector frame the equipment icons already use, so this
 * reuses `EquipmentIcon`. Empty slots paint nothing (frame 100 is authenticated
 * empty). Display only: no control is bound, as in the source.
 *
 * Coverage note: the source `mytech` also holds start flags and passes that the
 * port does not yet model as technology (see C1 audits); only modelled
 * technologies can appear here. */
import type { EquipmentView } from '@engine/ui/equipment-view';
import { EquipmentIcon } from '../equipment/equipment-icon';
import type { hudContent } from './hud-content';

type ItemSlots = NonNullable<(typeof hudContent.planes)[number]['itemSlots']>;

export function TechnologySlots({
  slots,
  technologyWeaponIds,
}: {
  readonly slots: ItemSlots;
  readonly technologyWeaponIds: EquipmentView['technologyWeaponIds'];
}) {
  return (
    <g data-technology-slots>
      {slots.map(slot => {
        const id = technologyWeaponIds[slot.index];
        if (id === undefined) return null;
        return (
          <g key={slot.index} transform={`matrix(${slot.matrix.join(' ')})`} data-technology-slot={slot.index + 1}>
            <EquipmentIcon weaponId={id} />
          </g>
        );
      })}
    </g>
  );
}
