/** Page-1-25841.as:966–985: access follows identity/geometry checks.
 * Selected actors follow their existing branch without a planet standing gate.
 * Training's planetpass is not implemented, so no bypass is supplied. */
import type { PixiSceneDefinition } from '@engine/rendering/pixi/configuration';
import type { PlanetContactView, SelectedContactView } from '@engine/ui/contact-view';
import type { PlayerSpatialView } from '@engine/ui/player-spatial-view';
import type { SystemStandingView } from '@engine/ui/system-standing-view';
import { unownedWorldContent } from '../../unowned-world-content';
import { canHailPlanet } from './contact-eligibility';

/** Shared dispatch for planet clicks, H and selected-ship repeat clicks. Identity
 * is checked by the caller; geometry precedes access and refusal feedback. */
export function requestContactHail(
  contact: PlanetContactView | SelectedContactView,
  standing: SystemStandingView | null,
  player: PlayerSpatialView,
  definition: PixiSceneDefinition,
  open: (route: 'planet' | 'selected', id: string) => void,
  refuse: (message: string) => void
): void {
  if (contact.kind === 'planet' && !canHailPlanet(contact, player, definition)) return;
  if (!canAccessHail(contact, standing)) {
    if (contact.kind === 'planet') refuse(planetHailRefusal(contact, definition));
    return;
  }
  open(contact.kind === 'planet' ? 'planet' : 'selected', contact.id);
}

export function canAccessHail(
  contact: PlanetContactView | SelectedContactView,
  standing: SystemStandingView | null
): boolean {
  if (contact.kind !== 'planet') return true;
  return standing?.systemId === contact.systemId && standing.value > 0;
}

/** Recovered type-13 event writer; strength is a frozen current-world fact.
 * Population/government remain authored until C14 supplies mutable ownership. */
export function planetHailRefusal(contact: PlanetContactView, definition: PixiSceneDefinition): string {
  const system = definition.systems.find(system => system.id === contact.systemId);
  if (!system) throw new Error('Missing hailed planet content.');
  const government =
    system.governmentId === null
      ? unownedWorldContent.governmentLabel
      : definition.governments.find(g => g.id === system.governmentId)?.name;
  if (!government || contact.strength === null) throw new Error('Missing hailed planet scan facts.');
  return `This planet refuses to answer hails. A scan has revealed the following data...\nPlanet Name: ${system.name}\nGovernment: ${government}\nPopulation: ${system.initialPopulationBillions} billion\nStrength: ${contact.strength}`;
}
