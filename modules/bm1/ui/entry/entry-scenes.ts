/** The one mapping from an entry view to the reviewed plane and files it shows.
 * Rendering and whole-entry preparation both use it, so the prepared set can
 * never drift from what a route actually displays. */
import { entryAsset, entryPlane } from './entry-content';
import { entryRoutes, entrySelections, type EntryRoute, type EntrySelection } from './entry-controller';

export interface EntryView {
  readonly route: EntryRoute;
  readonly selection: EntrySelection;
}

/** Recovered plane per route; preview/start planes vary with the selection. */
function entryPlaneId({ route, selection }: EntryView): string | null {
  if (route === 'instructions') return null;
  if (route === 'menu') return 'UI-03:authoring';
  if (route === 'options') return 'UI-04:authoring';
  if (route === 'keys') return 'UI-04.keys:authoring';
  if (route === 'saved') return 'UI-05:empty-slots';
  if (route === 'preview') return `UI-07:${selection}`;
  return `UI-06:${selection}`;
}

/** The plane (when the route has source controls) and the background file. The
 * preview shows the editable variant, whose fields are drawn by the host. */
export function entryScene(view: EntryView) {
  const id = entryPlaneId(view);
  const plane = id === null ? null : entryPlane(id);
  if (!plane) return { plane, file: 'instructions-1.svg' };
  const file = view.route === 'preview' ? plane.asset.replace('.svg', '-editable.svg') : plane.asset;
  return { plane, file };
}

/** Public URLs one view needs: its background plus every control state image. */
export function entrySceneAssets(view: EntryView): readonly string[] {
  const { plane, file } = entryScene(view);
  const controls = plane?.controls.flatMap(control => (control.artwork ? Object.values(control.artwork) : [])) ?? [];
  return [file, ...controls].map(entryAsset);
}

/**
 * Every implemented entry route and selection variant. The whole set (about
 * 16 MB of SVG) is prepared before the first menu reveal by product decision
 * (2026-11-07), so navigation inside the menu never waits or flashes.
 */
export function entryArtworkAssets(): readonly string[] {
  const views = entryRoutes.flatMap(route => entrySelections.map(selection => ({ route, selection })));
  return [...new Set(views.flatMap(entrySceneAssets))];
}
