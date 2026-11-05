/** Original six Symbol7 station selectors; unsupported commerce stays absent. */
import type { EquipmentView } from '../../../../src/ui/equipment-view';
import type { EquipmentIntent } from '../../../../src/simulation/features/equipment';
import type { GameModuleDefinition } from '../../../../src/content/schemas/game-module';
import { EquipmentIcon } from './equipment-icon';
import { equipmentContent, equipmentHitPath, sourceMatrix } from './equipment-content';
import { SourceControl } from '../source-control';
export function EquipmentStationOffers({ view, definition, onHint, onCommand }: {
  readonly view: EquipmentView; readonly definition: GameModuleDefinition;
  readonly onHint: (name: string, description: string) => void;
  readonly onCommand: (intent: EquipmentIntent) => void;
}) {
  return <>{equipmentContent.stationSlots.map(slot => {
    const offer = view.offers[slot.index];
    const weapon = definition.content.weaponDefinitions.find(w => w.id === offer?.weaponDefinitionId);
    if (!weapon || !offer) return null;
    const empire = definition.systems.find(system => system.id === view.systemId)!.governmentId === 16;
    const displayedPrice = empire ? weapon.basePrice / 4 : weapon.basePrice + view.marketAdjustment;
    const refusal = offer.refusal === 'ship-too-small' ? 'Your ship is too small to fit this.'
      : offer.refusal === 'funds' ? 'You do not have enough latinum to buy this.'
      : offer.refusal === 'duplicate' ? 'You already have this.'
      : offer.refusal === 'inventory-full' ? 'No free equipment positions.' : 'Equipment transaction is unavailable.';
    return <g key={slot.index} transform={`translate(303 110) ${sourceMatrix(slot.matrix)}`}
      onPointerEnter={() => onHint(`${weapon.name} - ${displayedPrice} ${empire ? 'units of deuranium' : 'bars'}`, weapon.description)}
      onPointerLeave={() => onHint('', '')}>
      <EquipmentIcon weaponId={weapon.id} />
      <SourceControl control={{ scriptOffset: slot.offset + 88, name: `item${slot.index + 1}`, depth: 3, artwork: null,
        paths: [equipmentHitPath(weapon.id)] }} label={`Buy equipment ${weapon.id}`} onActivate={() => {
          if (!offer.intent) { onHint(weapon.name, refusal); return; }
          onCommand(offer.intent);
        }} />
    </g>;
  })}</>;
}
