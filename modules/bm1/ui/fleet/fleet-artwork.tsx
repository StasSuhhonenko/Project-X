/** UI-14's nine authored Symbol7 roster instances and selected portrait.
 * Shared selector SVGs retain the child registration; the fleet instance matrix
 * is distinct from equipment/sale geometry. Missing item10/11 stay missing. */
import { z } from 'zod';
import type { FleetView } from '@engine/ui/fleet-view';
import { equipmentAsset, equipmentContent, sourceMatrix } from '../equipment/equipment-content';
import raw from '../fleet-data.json';
import { SourceControl } from '../source-control';

const finite = z.number().finite();
const content = z
  .object({
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    clips: z
      .array(
        z
          .object({
            name: z.string(),
            offset: z.number().int().positive(),
            scriptOffset: z.number().int().positive(),
            matrix: z
              .object({ a: finite, b: finite, c: finite, d: finite, tx: finite, ty: finite })
              .strict()
              .readonly(),
          })
          .strict()
          .readonly()
      )
      .length(10)
      .readonly(),
  })
  .strict()
  .readonly()
  .parse(raw);

export function FleetArtwork({
  fleet,
  slots,
  selectedDefinitionId,
  onHover,
  onSelect,
  onRollOut,
}: {
  readonly fleet: FleetView;
  readonly slots: readonly (string | null)[];
  readonly selectedDefinitionId: number | null;
  readonly onHover: (slot: number | null) => void;
  readonly onSelect: (slot: number) => void;
  readonly onRollOut: () => void;
}) {
  return (
    <g transform="translate(300 282)" data-fleet-roster>
      {content.clips.map((clip, index) => {
        const selected = clip.name === 'selected';
        const ship = fleet.ships.find(ship => ship.entityId !== null && ship.entityId === slots[index]);
        const definitionId = selected ? selectedDefinitionId : ship?.definitionId;
        const icon = equipmentContent.shipIcons.find(icon => icon.id === definitionId);
        if (!icon) return null;
        const b = icon.hitBounds;
        return (
          <g
            key={clip.offset}
            transform={sourceMatrix(clip.matrix)}
            data-fleet-icon={clip.name}
            onPointerEnter={() => {
              if (!selected) onHover(index);
            }}
            onPointerLeave={() => {
              if (!selected) onRollOut();
            }}
            onFocus={() => {
              if (!selected) onHover(index);
            }}
            onBlur={() => {
              if (!selected) onRollOut();
            }}
          >
            <image href={equipmentAsset(icon.file)} x={-100} y={-100} width={200} height={200} />
            {!selected && (
              <SourceControl
                control={{
                  scriptOffset: clip.scriptOffset,
                  name: clip.name,
                  depth: 3,
                  artwork: null,
                  paths: [`M${b.left},${b.top} H${b.right} V${b.bottom} H${b.left} Z`],
                }}
                label={`Fleet ship ${index + 1}: ${ship?.name ?? ''}`}
                onActivate={() => {
                  if (index < 2) onSelect(index);
                }}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}
