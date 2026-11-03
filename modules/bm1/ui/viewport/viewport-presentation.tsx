/** Persistent source top HUD and live minimap. World state owns membership;
 * module presentation owns the source projection, edge clamps and artwork. */
import { useId } from 'react';
import type { GameplayPresentationProps } from '../../../../src/ui/gameplay-presentation';
import { worldToScreen } from '../../../../src/rendering/world-camera';
import { HudGlyphField } from '../hud/hud-glyphs';
import { viewportAsset, viewportContent } from './viewport-content';

/** Page1:21886 compresses screen coordinates around (544,403) by100,
 * then clamps ordinary markers in source order at494/590 and372/440. */
export function minimapPoint(x: number, y: number) {
  return Object.freeze({
    x: Math.max(494, Math.min(590, 544 + (x - 544) / 100)),
    y: Math.max(372, Math.min(440, 403 + (y - 403) / 100)),
  });
}

export function ViewportPresentation({ hud, definition, spatialOverview = [] }:
  Pick<GameplayPresentationProps, 'hud' | 'definition' | 'spatialOverview'>) {
  const clip = useId();
  const resources: Readonly<Record<string, number>> = {
    hudlatinum: hud.resources.latinum ?? 0,
    huddeuranium: hud.resources.deuranium ?? 0,
    hudantimatter: hud.resources.antimatter ?? 0,
  };
  const weapon = viewportContent.weapons.find(weapon => weapon.id === hud.weaponDefinitionId);
  return <svg
    className="bm1-hud-stage bm1-viewport-hud"
    width="600"
    height="450"
    viewBox="0 0 600 450"
    aria-label="Resources and system minimap"
  >
    <image href={viewportAsset('viewport-top.svg')} width="600" height="450" />
    {weapon && <image href={viewportAsset(weapon.file)} width="600" height="450" data-top-weapon={weapon.id} />}
    {viewportContent.fields.map(({ field, transform: m }) => <g key={field.variable} transform={`matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.tx} ${m.ty})`}>
      <HudGlyphField field={field} font={viewportContent.font} text={String(resources[field.variable] ?? 0)} />
    </g>)}
    <image href={viewportAsset('viewport-minimap.svg')} width="600" height="450" />
    <defs><clipPath id={clip}><rect x="490" y="367" width="104" height="78" /></clipPath></defs>
    <g clipPath={`url(#${clip})`} data-minimap-count={spatialOverview.length}>
      {spatialOverview.map(entity => {
        const screen = worldToScreen(
          { x: entity.relativeX, y: entity.relativeY },
          { x: 0, y: 0 },
          definition.viewport,
          hud.zoom,
        );
        const point = minimapPoint(screen.x, screen.y);
        return <circle
          key={entity.id}
          cx={point.x}
          cy={point.y}
          r={entity.kind === 'planet' ? 1.8 : 1.2}
          fill={entity.kind === 'planet' ? 'black' : '#ccc'}
          stroke={entity.selected ? '#67adff' : '#ccc'}
          strokeWidth=".8"
          data-minimap-entity={entity.id}
        />;
      })}
      <path d="M544 401 L542.5 405 L545.5 405 Z" fill="#5187bf" aria-label="Your ship" />
    </g>
  </svg>;
}
