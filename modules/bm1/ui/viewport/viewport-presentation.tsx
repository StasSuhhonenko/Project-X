/** Persistent source top HUD and live minimap. World state owns membership;
 * module presentation owns the source projection, edge clamps and artwork. */
import { useId } from 'react';
import { worldToScreen } from '@engine/rendering/shared/world-camera';
import type { GameplayPresentationProps } from '../../presentation-contract';
import { EquippedIcons } from '../equipment/equipment-hud';
import { HudGlyphField } from '../hud/hud-glyphs';
import { MinimapMarker } from './minimap-marker';
import { viewportAsset, viewportContent } from './viewport-content';

export { minimapPoint } from './minimap-model';

export function ViewportPresentation({
  hud,
  definition,
  spatialOverview = [],
  equipment = null,
}: Pick<GameplayPresentationProps, 'hud' | 'definition' | 'spatialOverview' | 'equipment'>) {
  const clip = useId();
  const resources: Readonly<Record<string, number>> = {
    hudlatinum: hud.resources.latinum ?? 0,
    huddeuranium: hud.resources.deuranium ?? 0,
    hudantimatter: hud.resources.antimatter ?? 0,
  };
  const weapon = viewportContent.weapons.find(weapon => weapon.id === hud.weaponDefinitionId);
  return (
    <svg
      className="bm1-hud-stage bm1-viewport-hud"
      width="600"
      height="450"
      viewBox="0 0 600 450"
      aria-label="Resources and system minimap"
    >
      <image href={viewportAsset('viewport-top.svg')} width="600" height="450" />
      {equipment && <EquippedIcons view={equipment} />}
      {!equipment && weapon && (
        <image href={viewportAsset(weapon.file)} width="600" height="450" data-top-weapon={weapon.id} />
      )}
      {viewportContent.fields.map(({ field, transform: m }) => (
        <g key={field.variable} transform={`matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.tx} ${m.ty})`}>
          <HudGlyphField field={field} font={viewportContent.font} text={String(resources[field.variable] ?? 0)} />
        </g>
      ))}
      <image href={viewportAsset('viewport-minimap.svg')} width="600" height="450" />
      <defs>
        <clipPath id={clip}>
          <rect x="490" y="367" width="104" height="78" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`} data-minimap-count={spatialOverview.length}>
        {spatialOverview.map(entity => {
          const screen = worldToScreen(
            { x: entity.relativeX, y: entity.relativeY },
            { x: 0, y: 0 },
            definition.viewport,
            hud.zoom
          );
          return (
            <MinimapMarker
              key={`${entity.id}-${entity.selected}`}
              entity={entity}
              x={screen.x}
              y={screen.y}
              framesPerSecond={definition.framesPerSecond}
            />
          );
        })}
        <path d="M544 401 L542.5 405 L545.5 405 Z" fill="#5187bf" aria-label="Your ship" />
      </g>
    </svg>
  );
}
