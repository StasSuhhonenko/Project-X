/** Independent outfitting UI exercises the shared immutable equipment seam. */
import type { GameplayPresentationProps } from '@engine/ui/gameplay-presentation';

export function EquipmentPanel({
  equipment,
  definition,
  onEquipmentCommand,
}: Pick<GameplayPresentationProps, 'equipment' | 'definition' | 'onEquipmentCommand'>) {
  if (!equipment || !onEquipmentCommand) return null;
  const name = (id: number | null) => definition.content.weaponDefinitions.find(w => w.id === id)?.name ?? 'Empty';
  return (
    <section aria-label="Survey outfitting">
      <h2>Survey outfitting</h2>
      <p>Fire slots with Space, Z and X.</p>
      {equipment.channels.map((channel, index) => (
        <p key={index}>
          Slot {index + 1}: {name(channel.weaponDefinitionId)}
          <button
            disabled={channel.weaponDefinitionId === null}
            onClick={() => onEquipmentCommand(channel.unequipIntent)}
          >
            Clear slot {index + 1}
          </button>
        </p>
      ))}
      {equipment.owned
        .filter(item => item.weaponDefinitionId !== null)
        .map(item => (
          <div key={item.inventoryIndex}>
            <span>{name(item.weaponDefinitionId)}</span>
            {item.loadIntents.map((intent, channel) => (
              <button key={channel} onClick={() => onEquipmentCommand(intent)}>
                Fit item {item.inventoryIndex + 1} to slot {channel + 1}
              </button>
            ))}
            <button
              disabled={!item.sellIntent}
              onClick={() => {
                if (item.sellIntent) onEquipmentCommand(item.sellIntent);
              }}
            >
              Recycle item {item.inventoryIndex + 1}
            </button>
          </div>
        ))}
      {equipment.offers.map(
        (offer, index) =>
          offer.weaponDefinitionId !== null && (
            <button
              key={index}
              disabled={!offer.intent}
              onClick={() => {
                if (offer.intent) onEquipmentCommand(offer.intent);
              }}
            >
              Acquire {name(offer.weaponDefinitionId)}
              {offer.price !== null ? ` · ${offer.price} credits` : ''}
            </button>
          )
      )}
    </section>
  );
}
