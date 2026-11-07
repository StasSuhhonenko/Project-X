/** Source type11 sale route. Equipment and resource actions revalidate live
 * ownership through the host. Fleet sale remains with its feature owner. */
import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { GameModuleDefinition } from '@engine/content/schemas/game-module';
import type { ResourceSaleIntent } from '@engine/simulation/contracts/cargo-trade';
import type { EquipmentIntent } from '@engine/simulation/features/equipment';
import type { ResourceSalesView } from '@engine/ui/cargo-trade-view';
import type { EquipmentView } from '@engine/ui/equipment-view';
import { commerceAsset, commerceHitPath, commerceIcon } from '../commerce/commerce-content';
import { HudGlyphField } from '../hud/hud-glyphs';
import { SourceControl } from '../source-control';
import { equipmentAsset, equipmentContent, equipmentHitPath, sourceMatrix } from './equipment-content';
import { EquipmentIcon } from './equipment-icon';

export function equipmentSaleAssets({ view }: ComponentProps<typeof EquipmentSale>) {
  return equipmentSaleViewAssets(view);
}
/** Sale panel ink and icons for owned/technology items; shared with local preparation. */
export function equipmentSaleViewAssets(view: EquipmentView) {
  const ids = [...view.owned.map(item => item.weaponDefinitionId), ...view.technologyWeaponIds];
  return [
    equipmentAsset(equipmentContent.sale.panel),
    ...([101, 103] as const).map(id => commerceAsset(commerceIcon(id).file)),
    ...equipmentContent.icons.filter(icon => ids.includes(icon.id)).map(icon => equipmentAsset(icon.file)),
  ];
}
export function EquipmentSale({
  view,
  definition,
  onCommand,
  onExit,
  resourceSales,
  onSellResource,
  onTradeHint,
}: {
  readonly resourceSales?: ResourceSalesView | null;
  readonly onSellResource?: ((intent: ResourceSaleIntent) => boolean) | undefined;
  readonly onTradeHint?: ((text: string) => void) | undefined;
  readonly view: EquipmentView;
  readonly definition: GameModuleDefinition;
  readonly onCommand: (intent: EquipmentIntent) => void;
  readonly onExit: () => void;
}) {
  const [category, setCategory] = useState<'weapons' | 'devices' | 'resources' | null>(null);
  const [hint, setHint] = useState('');
  const owned = view.owned.filter(
    item =>
      item.weaponDefinitionId !== null &&
      (category === 'weapons' ? item.weaponDefinitionId < 20 : category === 'devices' && item.weaponDefinitionId >= 20)
  );
  // The original device list displays technology20/21, while its sale handler
  // searches weapon ownership only. Retain those visible, non-sellable entries.
  const technologies =
    category === 'devices'
      ? view.technologyWeaponIds.map((id, index) => ({
          inventoryIndex: view.owned.length + index,
          weaponDefinitionId: id,
          sellIntent: null,
          sellAmount: null,
        }))
      : [];
  const items = [...technologies, ...owned];
  return (
    <svg
      className="bm1-hud-stage bm1-contact-stage"
      viewBox="0 0 600 450"
      width={600}
      height={450}
      data-equipment-sale
      data-contact-kind="planet"
      aria-label="Sell equipment"
    >
      <image href={equipmentAsset(equipmentContent.sale.panel)} width={600} height={450} />
      {equipmentContent.sale.fields.map(({ field, transform }) => (
        <g key={field.offset} transform={`matrix(${transform.join(' ')})`}>
          <HudGlyphField field={field} text={field.variable === 'itemname' ? hint : ''} />
        </g>
      ))}
      {equipmentContent.sale.controls.map(control => {
        const b = control.stageBounds,
          source = control.offset + 88;
        const label =
          source === 75930
            ? 'Return to planet listing'
            : source === 71901
              ? 'List weapons for sale'
              : source === 71263
                ? 'List devices for sale'
                : source === 72339
                  ? 'List resources for sale'
                  : 'Unavailable sale category';
        return (
          <SourceControl
            key={source}
            control={{
              scriptOffset: source,
              name: '',
              depth: 3,
              artwork: null,
              paths: [`M${b.left},${b.top} H${b.right} V${b.bottom} H${b.left} Z`],
            }}
            label={label}
            disabled={![75930, 71901, 71263].includes(source) && !(source === 72339 && onSellResource)}
            onActivate={() => {
              if (source === 75930) {
                onExit();
                return;
              }
              setCategory(source === 71901 ? 'weapons' : source === 72339 ? 'resources' : 'devices');
              setHint('');
            }}
          />
        );
      })}
      {category === 'resources' &&
        equipmentContent.saleSlots.slice(0, 2).map(slot => {
          const resourceId = slot.index === 0 ? 'antimatter' : 'deuranium';
          const iconId = slot.index === 0 ? 101 : 103;
          const resource = resourceSales?.find(item => item.resourceId === resourceId);
          const hover =
            iconId === 101
              ? 'Click to sell 5 units of antimatter...'
              : 'Click to sell 1 unit...Shift-Click to sell all your deuranium.';
          return (
            <g
              key={resourceId}
              transform={`translate(303 110) ${sourceMatrix(slot.matrix)}`}
              onPointerEnter={() => setHint(hover)}
              onPointerLeave={() => setHint('')}
            >
              <title>
                {resourceId}: {resource?.balance ?? 0}
              </title>
              <image href={commerceAsset(commerceIcon(iconId).file)} x={-100} y={-100} width={200} height={200} />
              <SourceControl
                control={{
                  scriptOffset: slot.offset + 88,
                  name: `item${slot.index + 1}`,
                  depth: 3,
                  artwork: null,
                  paths: [commerceHitPath(iconId)],
                }}
                label={`Sell ${resourceId}`}
                disabled={!onSellResource}
                onActivate={({ shiftKey }) => {
                  const all = resourceId === 'deuranium' && shiftKey;
                  if (!onSellResource?.({ resourceId, all })) {
                    onTradeHint?.(`You have no ${resourceId} to sell...`);
                    return;
                  }
                  onTradeHint?.('');
                }}
              />
            </g>
          );
        })}
      {equipmentContent.saleSlots.map(slot => {
        const item = items[slot.index];
        if (!item?.weaponDefinitionId) return null;
        const weapon = definition.content.weaponDefinitions.find(w => w.id === item.weaponDefinitionId)!;
        return (
          <g
            key={slot.index}
            transform={`translate(303 110) ${sourceMatrix(slot.matrix)}`}
            onPointerEnter={() => setHint(`Your ${weapon.name} sells for ${item.sellAmount ?? 0} bars.`)}
            onPointerLeave={() => setHint('')}
          >
            <EquipmentIcon weaponId={item.weaponDefinitionId} />
            <SourceControl
              control={{
                scriptOffset: slot.offset + 88,
                name: `item${slot.index + 1}`,
                depth: 3,
                artwork: null,
                paths: [equipmentHitPath(item.weaponDefinitionId)],
              }}
              label={`Sell equipment ${item.inventoryIndex + 1}`}
              disabled={!item.sellIntent}
              onActivate={() => {
                if (item.sellIntent) onCommand(item.sellIntent);
                setHint('You have sold this...');
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}
