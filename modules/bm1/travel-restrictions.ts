/** Source mapclick() nebula-entry requirement (Page-1-25841.as:515).
 * Navigation experience/progression is not implemented in this bounded slice;
 * no current start or imported supported save can satisfy this requirement.
 * Starting inside one of these systems remains valid; only entry is refused.
 */
export const NEBULA_NAVIGATION_REQUIREMENT = Object.freeze({
  minimumExperience: 100,
  message: 'You do not have enough navigational experience to enter a nebula. 100+ experience needed.',
});
const NEBULA_DESTINATION_IDS: readonly number[] = Object.freeze([33, 32, 34]);

/** One authoritative source-ID join for simulation and module presentation. */
export function getTravelRestriction(destinationSystemId: number) {
  return NEBULA_DESTINATION_IDS.includes(destinationSystemId) ? NEBULA_NAVIGATION_REQUIREMENT : null;
}
