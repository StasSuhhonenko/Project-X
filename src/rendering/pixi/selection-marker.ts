/**
 * Pixi presentation of the selected-target marker.
 *
 * One private `Graphics` sits in the overlay layer. With a module policy
 * (`visuals.selectionMarker`) it draws the authored strokes once, measures the
 * target when a selection starts and then only moves and pulses. Without a
 * policy it shows the engine's neutral placeholder ring, which follows the
 * target's size at the current zoom.
 *
 * Size and pulse rules belong to `shared/selection-marker.ts`; this adapter
 * owns only Pixi objects and the start time of the current selection. The
 * Graphics is an ordinary display child, released with the scene.
 */
import { Graphics, type Container } from 'pixi.js';
import {
  displayedExtent,
  selectionMarkerAlpha,
  selectionMarkerScale,
  type SelectionMarkerAppearance,
} from '../shared/selection-marker';
import type { PixiSceneDefinition } from './configuration';
import { entityVisualSize } from './entity-visual-size';
import { traceVectorPath } from './vector-path';

type EntityVisual = PixiSceneDefinition['visuals']['entities'][number];

/** The selected target as presented this display frame. */
export interface SelectionMarkerTarget {
  readonly entityId: string;
  readonly visual: EntityVisual;
  /** Presented rotation, in degrees, of the target artwork. */
  readonly rotationDegrees: number;
  /** Target registration point in logical screen pixels. */
  readonly screen: Readonly<{ x: number; y: number }>;
}

export interface SelectionMarker {
  /** Place the marker on `target`, or hide it for `null`. */
  render(target: SelectionMarkerTarget | null, cameraZoom: number, nowMs: number): void;
}

function drawAuthored(graphics: Graphics, appearance: SelectionMarkerAppearance): void {
  appearance.strokes.forEach(stroke => {
    traceVectorPath(graphics, stroke.path);
    graphics.stroke({ color: stroke.color, width: stroke.widthPixels });
  });
}

export function createSelectionMarker(
  definition: Pick<PixiSceneDefinition, 'visuals' | 'framesPerSecond'>,
  layer: Container
): SelectionMarker {
  const appearance = definition.visuals.selectionMarker;
  const graphics = new Graphics();
  // Placeholder: a unit circle scaled to the target's radius plus a margin.
  if (appearance) drawAuthored(graphics, appearance);
  else graphics.circle(0, 0, 1).stroke({ color: 0xffd36a, width: 0.08 });
  graphics.visible = false;
  layer.addChild(graphics);
  // The current selection's identity and start time. A new target, or the same
  // target selected again after a deselection, starts a new marker.
  let shownEntityId: string | null = null;
  let startedAtMs = 0;

  const render: SelectionMarker['render'] = (target, cameraZoom, nowMs) => {
    graphics.visible = target !== null;
    if (!target) {
      shownEntityId = null;
      return;
    }
    graphics.position.set(target.screen.x, target.screen.y);
    if (!appearance) {
      const size = entityVisualSize(target.visual);
      graphics.scale.set((Math.max(size.width, size.height) / 2 + 8) / cameraZoom);
      return;
    }
    if (shownEntityId !== target.entityId) {
      shownEntityId = target.entityId;
      startedAtMs = nowMs;
      const extent = displayedExtent(entityVisualSize(target.visual), target.rotationDegrees, cameraZoom);
      const scale = selectionMarkerScale(appearance, extent);
      graphics.scale.set(scale.x, scale.y);
    }
    graphics.alpha = selectionMarkerAlpha(appearance, nowMs - startedAtMs, definition.framesPerSecond);
  };
  return { render };
}
