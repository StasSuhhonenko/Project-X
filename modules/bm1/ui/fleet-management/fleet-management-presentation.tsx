/** React/SVG projection of the held type-25 display list. */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { GameModuleDefinition } from '@engine/content/schemas/game-module';
import type { FleetManagementIntent } from '@engine/simulation/features/fleet-management';
import type { FleetManagementView } from '@engine/ui/fleet-management-view';
import { CONTACT_LAYOUT as layout } from '../contact/contact-layout';
import { hasUnsupportedSourceGlyph } from '../entry/editable-source-input';
import { sourceMatrix } from '../equipment/equipment-content';
import { displayedStep } from '../frame-step';
import { HudGlyphField } from '../hud/hud-glyphs';
import { isKeyboardVisibleFocus, SourceControl } from '../source-control';
import { usePresentationClock } from '../use-presentation-clock';
import {
  fleetManagementContent as content,
  fleetManagementArtworkAssets,
  fleetManagementImageUrl,
  fleetManagementPortraitUrl,
  type FleetManagementAction,
} from './fleet-management-content';
import type { FleetManagementController } from './fleet-management-controller';
import { createFleetManagementReadModel, fleetManagementHint } from './fleet-management-read-model';

export interface FleetManagementPresentationProps {
  readonly controller: FleetManagementController;
  readonly view: FleetManagementView | null;
  readonly definition: Pick<GameModuleDefinition, 'content'>;
  readonly available: boolean;
  readonly overlay: HTMLElement | null;
  readonly framesPerSecond: number;
  readonly onManageFleet?: ((intent: FleetManagementIntent) => boolean) | undefined;
  readonly onHint: (hint: string) => void;
}
export const fleetManagementPresentationAssets = ({ view }: FleetManagementPresentationProps) =>
  fleetManagementArtworkAssets(view?.rows);

const exitSelector = '[data-fleet-management-control="exit"] [data-source-control]';
// Stable depth order from the compiled timeline. Arrow paint and hit share a
// depth, with the passive bitmap first and the glyph in its own later depth.
const display = [
  ...content.images.map(item => ({ kind: 'image' as const, item })),
  ...content.fields.map(item => ({ kind: 'field' as const, item })),
  ...content.controls.map(item => ({ kind: 'control' as const, item })),
  { kind: 'portrait' as const, item: content.portrait },
].sort((a, b) => a.item.depth - b.item.depth);

function FleetManagementArtwork({
  overlay,
  model,
  scale,
  displayedScale,
  armed,
  onRelease,
  onHint,
}: {
  readonly overlay: HTMLElement;
  readonly model: ReturnType<typeof createFleetManagementReadModel>;
  readonly scale: number;
  /** Drawn percentage for the shared artwork and pointer geometry. */
  readonly displayedScale: number;
  readonly armed: boolean;
  readonly onRelease: (action: FleetManagementAction) => void;
  readonly onHint: FleetManagementPresentationProps['onHint'];
}) {
  const panel = useRef<SVGSVGElement>(null);
  const [hintAction, setHintAction] = useState<FleetManagementAction | null>(null);
  const hint = fleetManagementHint(hintAction, armed);
  const clearHint = (action: FleetManagementAction) => setHintAction(current => (current === action ? null : current));
  useEffect(() => onHint(hint), [hint, onHint]);
  useEffect(() => () => onHint(''), [onHint]);
  useEffect(() => {
    const current = panel.current;
    current?.querySelector<SVGGElement>(exitSelector)?.focus();
    return () => {
      const focused = document.activeElement;
      if (focused === document.body || current?.contains(focused))
        overlay.closest<HTMLElement>('.bm1-game-stage')?.focus();
    };
  }, [overlay]);
  return (
    <svg
      ref={panel}
      className="bm1-hud-stage bm1-contact-stage"
      width={layout.stageWidth}
      height={layout.stageHeight}
      viewBox={`0 0 ${layout.stageWidth} ${layout.stageHeight}`}
      aria-label="Fleet management"
      data-fleet-management-type={content.type}
      data-fleet-management-scale={scale}
    >
      <g
        transform={`translate(${layout.parentX} ${layout.parentY}) scale(${displayedScale / layout.maximumScale}) translate(${-layout.parentX} ${-layout.parentY})`}
      >
        {content.blocker.map(path => (
          <path key={path} d={path} fill="transparent" className="bm1-contact-blocker" />
        ))}
        {display.map(({ kind, item }) => {
          if (kind === 'image') {
            const { depth, file, ...geometry } = item;
            return (
              <image
                key={`ink-${depth}`}
                href={fleetManagementImageUrl(file)}
                {...geometry}
                preserveAspectRatio="none"
              />
            );
          }
          if (kind === 'portrait') {
            if (model.portraitDefinitionId === null) return null;
            return (
              <g key={item.depth} transform={sourceMatrix(item.transform)}>
                <image
                  href={fleetManagementPortraitUrl(model.portraitDefinitionId)}
                  x={-100}
                  y={-100}
                  width={200}
                  height={200}
                />
              </g>
            );
          }
          if (kind === 'field') {
            const { field, label, depth } = item;
            const text =
              field.variable === 'itemdesc' ? model.itemdesc : field.variable === 'loctext' ? model.loctext : label;
            return <HudGlyphField key={depth} field={field} text={text} />;
          }
          return (
            <g
              key={item.depth}
              data-fleet-management-control={item.action}
              onPointerEnter={item.hint ? () => setHintAction(item.action) : undefined}
              onPointerLeave={item.hint ? () => clearHint(item.action) : undefined}
              onFocus={
                item.hint
                  ? event => {
                      // A pointer release can move browser focus. It must not keep
                      // the rollover writer active after the pointer leaves.
                      if (isKeyboardVisibleFocus(event.target)) setHintAction(item.action);
                    }
                  : undefined
              }
              onBlur={item.hint ? () => clearHint(item.action) : undefined}
            >
              <SourceControl
                control={{
                  scriptOffset: item.offset,
                  name: item.action,
                  depth: item.depth,
                  artwork: null,
                  paths: item.paths,
                }}
                label={item.label}
                onActivate={() => onRelease(item.action)}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export function FleetManagementPresentation({
  controller,
  definition,
  view,
  available,
  overlay,
  framesPerSecond,
  onManageFleet,
  onHint,
}: FleetManagementPresentationProps) {
  const { attachment, revision } = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const active = Boolean(
    attachment && available && overlay && view?.stationEntityIds.includes(attachment.stationEntityId)
  );
  const animating = active && attachment !== null && attachment.scale < layout.maximumScale;
  const fraction = usePresentationClock(animating, framesPerSecond, controller.advance, revision, animating);
  const row = view?.rows.find(candidate => candidate.ownedShipId === attachment?.selectedOwnedShipId) ?? null;
  const destination = attachment?.destinationSystemId ?? null;
  const model = useMemo(() => {
    if (!active) return null;
    const receivers = createFleetManagementReadModel(row, destination, definition);
    // Custom names can outlive a save. Never pass unsupported text to the
    // source glyph renderer, where a missing character would crash the scene.
    return hasUnsupportedSourceGlyph(receivers.itemdesc) || hasUnsupportedSourceGlyph(receivers.loctext)
      ? null
      : receivers;
  }, [active, row, destination, definition]);
  if (!active || !attachment || !view || !overlay) return null;
  if (!model) {
    return (
      <div className="bm1-panel-loading" role="alert" data-game-input="blocked">
        <p>Fleet management artwork cannot display this ship’s name.</p>
        <button onClick={controller.close}>Exit Menu</button>
      </div>
    );
  }
  return createPortal(
    <FleetManagementArtwork
      key={revision}
      overlay={overlay}
      model={model}
      scale={attachment.scale}
      displayedScale={displayedStep(attachment.scale, layout.maximumScale, layout.growthPerFrame, fraction)}
      armed={attachment.armedOwnedShipId !== null}
      onRelease={action => controller.release(action, view, onManageFleet)}
      onHint={onHint}
    />,
    overlay
  );
}
