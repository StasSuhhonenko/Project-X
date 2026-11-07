/** Glyph preflight is shared with the authenticated HUD font. No route arithmetic. */
import type { RouteErrorKind, RouteView } from '@engine/ui/route-view';
import { getTravelRestriction } from '../../travel-restrictions';
import { sourceMapLabel } from '../../unowned-world-content';
import { layoutHudText } from '../hud/hud-glyphs';
import { mapContent } from './map-content';

/** Select the BM1 source writer from host-owned failure facts. Geometry,
 * payment and strict reserve policy remain entirely in the simulation. */
export function isSourceMapFuelRefusal(
  kind: RouteErrorKind | null,
  status: RouteView['departureStatus'] | undefined,
  destinationSystemId: number | null = null,
  navigationExperience = 0
) {
  return (
    kind === 'departure' &&
    (status === 'rule-refused' || status === 'insufficient-fuel') &&
    !(
      status === 'rule-refused' &&
      destinationSystemId !== null &&
      getTravelRestriction(destinationSystemId, navigationExperience)
    )
  );
}

export function createMapReadModel(
  route: RouteView,
  hover: number | null,
  message: 'current' | 'navigation-error' | 'fuel-refusal' | 'travel-restriction',
  navigationExperience = 0
) {
  const destination = route.destinations.find(d => d.systemId === hover);
  const current = hover === route.systemId;
  const quote = destination?.quote;
  let text = `You are currently in the ${route.currentSystemName} system.`;
  if (current) text = 'You are currently in this system.';
  if (!current && destination && quote?.status === 'estimated') {
    text = `It will take you ${quote.durationDays} days to reach this destination.`;
  }
  if (message === 'navigation-error') text = 'NAVIGATIONAL ERROR: You are already in this system...';
  if (message === 'fuel-refusal') text = 'You have insufficient antimatter resources to travel to this system...';
  if (message === 'travel-restriction' && route.destinationSystemId !== null) {
    text = getTravelRestriction(route.destinationSystemId, navigationExperience)?.message ?? text;
  }
  const labels = new Map(
    route.destinations.map(destination => [
      `planet${destination.systemId}`,
      sourceMapLabel(destination.systemId, destination.name),
    ])
  );
  const texts: Readonly<Record<string, string>> = Object.freeze(
    Object.fromEntries(
      mapContent.fields.map(({ field }) => [
        field.variable,
        field.variable === 'maptext' ? text : (labels.get(field.variable) ?? ''),
      ])
    )
  );
  mapContent.fields.forEach(({ field }) => layoutHudText(field, texts[field.variable] ?? ''));
  return Object.freeze({ texts, text });
}
