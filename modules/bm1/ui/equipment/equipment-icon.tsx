/** Source Symbol7 local coordinates, preserving bitmap and backing registration. */
import { equipmentAsset, equipmentContent } from './equipment-content';

export function EquipmentIcon({ weaponId }: { readonly weaponId: number | null }) {
  const icon = equipmentContent.icons.find(icon => icon.id === weaponId);
  return icon ? <image href={equipmentAsset(icon.file)} x={-100} y={-100} width={200} height={200} /> : null;
}
