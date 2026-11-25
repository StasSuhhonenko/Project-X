/** UI-22 held frame15/16. Recovered dynamic name is intentionally not editable. */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { ConstructionView } from '@engine/ui/construction-view';
import { isConstructionDestinationHidden } from '../../construction-rules';
import { HudGlyphField } from '../hud/hud-glyphs';
import { SourceControl } from '../source-control';
import { usePresentationClock } from '../use-presentation-clock';
import {
  constructionAsset,
  constructionAssets,
  constructionContent as content,
  hitPath,
  planIcon,
} from './construction-content';
import type { ConstructionController, ConstructionDraft } from './construction-controller';

export const constructionPresentationAssets = constructionAssets;
export interface ConstructionPresentationProps {
  readonly controller: ConstructionController;
  readonly plans: ConstructionView['plans'];
  readonly destinationNames: Readonly<Partial<Record<number, string>>>;
  readonly available: boolean;
  readonly overlay: HTMLDivElement | null;
  readonly framesPerSecond: number;
  readonly onBegin?: ((draft: ConstructionDraft) => boolean) | undefined;
}
export function ConstructionArtwork({
  controller,
  plans,
  destinationNames,
  onBegin,
}: Pick<ConstructionPresentationProps, 'controller' | 'plans' | 'destinationNames' | 'onBegin'>) {
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const draft = view.draft;
  if (!draft) return null;
  const plan = plans[draft.planIndex];
  if (!plan || plan.structureDefinitionId !== draft.structureDefinitionId) return null;
  const values: Readonly<Record<string, string>> = {
    name: draft.name,
    buildcost:
      'Needs ' +
      plan.basePrice / 10 +
      ' units of deuranium.\nConstruction will take ' +
      plan.constructionScale * 100 +
      ' days.',
    loctext: draft.destinationSystemId === null ? '' : (destinationNames[draft.destinationSystemId] ?? ''),
  };
  const preview = content.previewMatrix;
  return (
    <svg
      className="bm1-hud-stage bm1-contact-stage"
      width={600}
      height={450}
      viewBox="0 0 600 450"
      aria-label="Station builder"
      data-construction-scale={view.scale}
    >
      <g transform={'translate(303 110) scale(' + view.scale / 100 + ') translate(-303 -110)'}>
        <image href={constructionAsset('builder.svg')} width={600} height={450} />
        <g transform={'matrix(' + [preview.a, preview.b, preview.c, preview.d, preview.tx, preview.ty].join(' ') + ')'}>
          <image
            href={constructionAsset(planIcon(plan.structureDefinitionId).file)}
            x={-100}
            y={-100}
            width={200}
            height={200}
          />
        </g>
        {content.fields
          .filter(
            record =>
              !isConstructionDestinationHidden(draft.structureDefinitionId) || record.field.variable !== 'loctext'
          )
          .map(record => (
            <HudGlyphField
              key={record.field.offset}
              field={record.field}
              text={record.field.variable ? (values[record.field.variable] ?? '') : record.text}
            />
          ))}
        {content.controls.map(control => (
          <SourceControl
            key={control.offset}
            control={{ scriptOffset: control.offset, name: '', depth: 3, artwork: null, paths: [hitPath(control)] }}
            label={
              control.offset === 77055
                ? 'Cancel Build'
                : control.offset === 77322
                  ? 'Begin Build'
                  : control.offset === 77698
                    ? 'Previous destination'
                    : 'Next destination'
            }
            onActivate={() => {
              if (control.offset === 77055) {
                controller.close();
                return;
              }
              if (control.offset === 77322) {
                onBegin?.(draft);
                return;
              }
              controller.destination(control.offset === 77698 ? -1 : 1);
            }}
          />
        ))}
      </g>
    </svg>
  );
}
export function ConstructionPresentation(props: ConstructionPresentationProps) {
  const { controller, available, overlay, framesPerSecond } = props;
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const stage = useRef<HTMLDivElement>(null);
  const open = view.draft !== null;
  usePresentationClock(
    Boolean(view.draft) && available && Boolean(overlay),
    framesPerSecond,
    controller.advance,
    view.revision
  );
  useEffect(() => {
    if (!open || !available || !overlay) return;
    const key = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'q') return;
      event.preventDefault();
      controller.close();
    };
    window.addEventListener('keydown', key);
    stage.current?.focus();
    return () => {
      window.removeEventListener('keydown', key);
      overlay.closest<HTMLElement>('.bm1-game-stage')?.focus();
    };
  }, [open, available, overlay, controller]);
  if (!view.draft || !available || !overlay) return null;
  return createPortal(
    <div ref={stage} tabIndex={-1} data-game-input="blocked">
      <ConstructionArtwork {...props} />
    </div>,
    overlay
  );
}
