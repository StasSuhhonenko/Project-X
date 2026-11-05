/** Source type11 sale route. Equipment lists are live; fleet/resources retain
 * their own feature owners. Sale removes ownership and matching channels once. */
import { useState } from 'react';
import type { EquipmentView } from '../../../../src/ui/equipment-view';
import type { EquipmentIntent } from '../../../../src/simulation/features/equipment';
import type { GameModuleDefinition } from '../../../../src/content/schemas/game-module';
import { EquipmentIcon } from './equipment-icon';
import { equipmentContent, equipmentAsset, equipmentHitPath, sourceMatrix } from './equipment-content';
import { HudGlyphField } from '../hud/hud-glyphs';
import { SourceControl } from '../source-control';
export function EquipmentSale({ view, definition, onCommand, onExit }: {
  readonly view: EquipmentView; readonly definition: GameModuleDefinition;
  readonly onCommand: (intent: EquipmentIntent) => void; readonly onExit: () => void;
}) {
  const [category, setCategory] = useState<'weapons' | 'devices' | null>(null);
  const [hint, setHint] = useState('');
  const owned = view.owned.filter(item => item.weaponDefinitionId !== null
    && (category === 'weapons' ? item.weaponDefinitionId < 20 : category === 'devices' && item.weaponDefinitionId >= 20));
  // The original device list displays technology20/21, while its sale handler
  // searches weapon ownership only. Retain those visible, non-sellable entries.
  const technologies = category === 'devices' ? view.technologyWeaponIds.map((id, index) => ({
    inventoryIndex: view.owned.length + index, weaponDefinitionId: id, sellIntent: null, sellAmount: null,
  })) : [];
  const items = [...technologies, ...owned];
  return <svg className="bm1-hud-stage bm1-contact-stage" viewBox="0 0 600 450" width={600} height={450} data-equipment-sale data-contact-kind="planet" aria-label="Sell equipment">
    <image href={equipmentAsset(equipmentContent.sale.panel)} width={600} height={450} />
    {equipmentContent.sale.fields.map(({field,transform}) => <g key={field.offset} transform={`matrix(${transform.join(' ')})`}>
      <HudGlyphField field={field} text={field.variable === 'itemname' ? hint : ''} />
    </g>)}
    {equipmentContent.sale.controls.map(control => {
      const b = control.stageBounds, source = control.offset + 88;
      const label = source === 75930 ? 'Return to planet listing' : source === 71901 ? 'List weapons for sale'
        : source === 71263 ? 'List devices for sale' : 'Unavailable sale category';
      return <SourceControl key={source} control={{scriptOffset:source,name:'',depth:3,artwork:null,
        paths:[`M${b.left},${b.top} H${b.right} V${b.bottom} H${b.left} Z`]}} label={label}
        disabled={![75930,71901,71263].includes(source)} onActivate={() => {
          if (source === 75930) { onExit(); return; }
          setCategory(source === 71901 ? 'weapons' : 'devices'); setHint('');
        }} />;
    })}
    {equipmentContent.saleSlots.map(slot => {
      const item = items[slot.index];
      if (!item?.weaponDefinitionId) return null;
      const weapon = definition.content.weaponDefinitions.find(w => w.id === item.weaponDefinitionId)!;
      return <g key={slot.index} transform={`translate(303 110) ${sourceMatrix(slot.matrix)}`}
        onPointerEnter={() => setHint(`Your ${weapon.name} sells for ${item.sellAmount ?? 0} bars.`)} onPointerLeave={() => setHint('')}>
        <EquipmentIcon weaponId={item.weaponDefinitionId} />
        <SourceControl control={{scriptOffset:slot.offset+88,name:`item${slot.index+1}`,depth:3,artwork:null,paths:[equipmentHitPath(item.weaponDefinitionId)]}}
          label={`Sell equipment ${item.inventoryIndex + 1}`} disabled={!item.sellIntent} onActivate={() => {
            if (item.sellIntent) onCommand(item.sellIntent);setHint('You have sold this...');
          }} />
      </g>;
    })}
  </svg>;
}
