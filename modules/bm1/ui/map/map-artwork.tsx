/** Authenticated map ink and source hit regions, in logical stage pixels.
 * Attachment/focus/clock ownership remains in MapPresentation.
 */
import { useId, type RefObject } from 'react';
import type { RouteView, RoutePhase } from '../../../../src/ui/route-view';
import type { createMapController } from './map-controller';
import type { createMapReadModel } from './map-read-model';
import { mapContent, mapAsset } from './map-content';
import { MAP_LAYOUT as layout } from './map-layout';
import { HudGlyphField } from '../hud/hud-glyphs';
import { SourceControl } from '../source-control';

type MapController = ReturnType<typeof createMapController>;
export function MapArtwork({ route, phase, view, model, controller, closeRef, onDepartTo }: {
  readonly route: RouteView;
  readonly phase: RoutePhase;
  readonly view: ReturnType<MapController['getSnapshot']>;
  readonly model: ReturnType<typeof createMapReadModel>;
  readonly controller: MapController;
  readonly closeRef: RefObject<SVGGElement | null>;
  readonly onDepartTo: (id: number) => void;
}) {
  const clip = useId();
  const marker = mapContent.markers.find(candidate => candidate.systemId === route.systemId);
  return <svg className="bm1-hud-stage bm1-map-stage" viewBox="0 0 600 450" width="600" height="450"
    aria-label="Navigation map" data-map-scale={view.scale} data-map-current={route.systemId}
    data-map-selected={route.destinationSystemId ?? ''}>
    <g transform={`translate(${layout.parentX} ${layout.parentY}) scale(${view.scale / 100}) translate(${-layout.parentX} ${-layout.parentY})`}>
      {mapContent.controls.filter(control => control.layer === 1).map(control =>
        <rect key={control.offset} x={control.left} y={control.top}
          width={control.right - control.left} height={control.bottom - control.top}
          fill="black" className="bm1-contact-blocker" />)}
      <image href={mapAsset(mapContent.frame)} width="600" height="450" />
      <defs>
        <clipPath id={clip} transform={`translate(${layout.parentX} ${layout.parentY})`}>
          <path d={mapContent.maskPath} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {marker && <g transform={`translate(${marker.x} ${marker.y}) rotate(${view.rotation}) translate(${-layout.currentArtworkX} ${-layout.currentArtworkY})`}
          opacity={Math.min(1, view.alpha / 100)}>
          <image href={mapAsset(mapContent.selected)} width="600" height="450" data-map-current-indicator={route.systemId} />
        </g>}
        {mapContent.fields.map(({ field, transform }) =>
          <g key={field.offset} transform={`matrix(${transform.join(' ')})`}>
            <HudGlyphField field={field} text={model.texts[field.variable] ?? ''} />
          </g>)}
        {mapContent.markers.map(destinationMarker => {
          const destination = route.destinations.find(candidate => candidate.systemId === destinationMarker.systemId);
          if (!destination) return null;
          const hover = () => controller.hover(destinationMarker.systemId);
          const leave = () => controller.hover(null);
          const activate = () => {
            if (destinationMarker.systemId === route.systemId) {
              controller.currentError();
              return;
            }
            onDepartTo(destinationMarker.systemId);
          };
          return <g key={destinationMarker.systemId} transform={`translate(${destinationMarker.x} ${destinationMarker.y})`}
            data-map-marker={destinationMarker.systemId} onPointerEnter={hover} onPointerLeave={leave}
            onFocus={hover} onBlur={leave}>
            <SourceControl control={{ scriptOffset: destinationMarker.offset, name: `planet${destinationMarker.systemId}`,
              depth: 3, paths: destinationMarker.paths, artwork: null }} label={`Travel to ${destination.name}`}
              disabled={phase !== 'ready'} onActivate={activate} />
          </g>;
        })}
      </g>
      {mapContent.controls.filter(control => control.offset === layout.closeOffset).map(control =>
        <g key={control.offset} ref={closeRef} clipPath={`url(#${clip})`}>
          <SourceControl control={{ scriptOffset: control.offset + 88, name: '', depth: control.layer, artwork: null,
            paths: [`M${control.left},${control.top} H${control.right} V${control.bottom} H${control.left} Z`] }}
            label="Close navigation map" onActivate={controller.close} />
        </g>)}
    </g>
  </svg>;
}
