import type { ReactNode } from 'react';
/** Paints one source HUD plane. Geometry, mask transforms, glyph order and Hit
 * ownership stay together; scene attachment commands remain with composition. */
import { useRef } from 'react';
import type { GameplayPresentationProps } from '../../../../src/ui/gameplay-presentation';
import { hudAsset, type hudContent, type HudAction } from './hud-content';
import type { createHudController } from './hud-controller';
import type { createHudReadModel } from './hud-read-model';
import { HudGlyphField } from './hud-glyphs';
import { SourceIdentityText } from '../entry/editable-source-input';
import { HUD_LAYOUT } from './hud-layout';
import { SourceControl } from '../source-control';

export function HudArtwork({ plane, view, model, texts, hud, controller, onActivate, equipmentSlot }: {
  readonly plane: (typeof hudContent.planes)[number];
  readonly view: ReturnType<ReturnType<typeof createHudController>['getSnapshot']>;
  readonly model: ReturnType<typeof createHudReadModel>;
  readonly texts: Readonly<Record<string, string>>;
  readonly hud: GameplayPresentationProps['hud'];
  readonly controller: Pick<ReturnType<typeof createHudController>, 'getSnapshot' | 'rollOut' | 'activate' | 'hint'>;
  readonly onActivate: (action: HudAction) => void;
  readonly equipmentSlot?: ReactNode;
}) {
  const stage = useRef<SVGSVGElement>(null);
  const rollOut = (clientX: number, clientY: number) => {
    const matrix = stage.current?.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    controller.rollOut(point.x - HUD_LAYOUT.parentX, point.y - controller.getSnapshot().parentY);
  };
  return <svg ref={stage} className="bm1-hud-stage" width={HUD_LAYOUT.stageWidth} height={HUD_LAYOUT.stageHeight}
        viewBox={`0 0 ${HUD_LAYOUT.stageWidth} ${HUD_LAYOUT.stageHeight}`} aria-label="Player control panel"
        onPointerLeave={event => rollOut(event.clientX, event.clientY)}>
        <g transform={`translate(0 ${view.parentY - HUD_LAYOUT.artworkParentY})`}>
          <image href={hudAsset(plane.asset)} width={HUD_LAYOUT.stageWidth} height={HUD_LAYOUT.stageHeight} className="bm1-hud-ink" />
          {plane.fields.map(field => ['playername', 'playership'].includes(field.variable)
            ? <SourceIdentityText key={field.offset} field={field} text={texts[field.variable] ?? ''} />
            : <HudGlyphField key={field.offset} field={field} text={texts[field.variable] ?? ''} />)}
          {plane.masks.map(mask => {
            const scale = model.masks[mask.name as keyof typeof model.masks] ?? 100;
            const gauge = model.gauges[mask.name as keyof typeof model.gauges];
            const [a, b, c, d, x, y] = mask.matrix;
            return <path key={mask.offset} data-hud-mask={mask.name} data-hud-mask-percent={scale} d={mask.path} fill="black"
              {...(gauge ? { role: 'meter', 'aria-label': gauge.label, 'aria-valuenow': gauge.current, 'aria-valuemax': gauge.maximum, 'aria-valuemin': 0 } : {})}
              transform={`matrix(${a * scale / 100} ${b * scale / 100} ${c} ${d} ${x} ${y})`} />;
          })}
          {plane.controls.map(control => {
            const actualTop = control.top + view.parentY - HUD_LAYOUT.artworkParentY;
            const actualBottom = control.bottom + view.parentY - HUD_LAYOUT.artworkParentY;
            const unavailable = control.action === 'unavailable' || (control.action === 'map' && (hud.repairing || hud.systemId > 50));
            if (actualTop >= HUD_LAYOUT.stageHeight || actualBottom <= 0) return null;
            const paths = [`M ${control.left} ${control.top} L ${control.right} ${control.top} L ${control.right} ${control.bottom} L ${control.left} ${control.bottom} Z`];
            if (control.action === 'rollover') return <g key={control.offset} onPointerEnter={() => controller.activate('rollover')}
              onPointerLeave={event => rollOut(event.clientX, event.clientY)}>
              <SourceControl control={{ scriptOffset: control.offset + 88, name: '', depth: control.layer, paths, artwork: null }} label="Open player panel" onActivate={() => { controller.activate('rollover'); }} />
            </g>;
            return <g key={control.offset} onPointerEnter={() => controller.hint(control.hint)} onPointerLeave={() => controller.hint('')}
              onFocus={() => controller.hint(control.hint)} onBlur={() => controller.hint('')}>
              <SourceControl control={{ scriptOffset: control.offset + 88, name: '', depth: control.layer, paths, artwork: null }} label={control.label}
                disabled={unavailable} onActivate={() => {
                  if (unavailable) return;
                  onActivate(control.action);
                }} />
            </g>;
          })}
          {equipmentSlot}
        </g>
      </svg>;
}
