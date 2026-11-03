/** Authoritative player sprite sizing/registration shared by spatial adapters. */
import type { GameModuleDefinition } from '../content/schemas/game-module';

/**
 * The player remains at cameraAnchor even when the world zoom pivot differs.
 * Logical input sizes already include the authored entity scale. AABB sizes
 * include rotation but not position/pivot; width/height are local.
 * Callers may supply an interpolated heading for a display frame; UI projections
 * supply the committed heading. This helper never owns simulation state.
 */
export function playerGeometry(
  viewport: GameModuleDefinition['viewport'],
  logicalSize: Readonly<{ width: number; height: number }>,
  headingDegrees: number,
  zoom: number,
) {
  const anchor = viewport.cameraAnchor ?? { x: viewport.width / 2, y: viewport.height / 2 };
  const width = logicalSize.width / zoom;
  const height = logicalSize.height / zoom;
  const radians = headingDegrees * Math.PI / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  return Object.freeze({ x: anchor.x, y: anchor.y, width, height, headingDegrees, zoom,
    boundsWidth: width * cosine + height * sine,
    boundsHeight: width * sine + height * cosine });
}
