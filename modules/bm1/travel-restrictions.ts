/** Source mapclick() nebula-entry requirement (Page-1-25841.as:515).
 * Captain navigation experience unlocks entry at the exact source threshold.
 * Starting inside one of these systems remains valid; only entry is refused.
 */
export const NEBULA_NAVIGATION_REQUIREMENT = Object.freeze({
  minimumExperience: 100,
  message: 'You do not have enough navigational experience to enter a nebula. 100+ experience needed.',
});
const NEBULA_DESTINATION_IDS: readonly number[] = Object.freeze([33, 32, 34]);

/** One authoritative source-ID join for simulation and module presentation. */
export function getTravelRestriction(destinationSystemId: number, navigationExperience = 0) {
  return NEBULA_DESTINATION_IDS.includes(destinationSystemId) &&
    navigationExperience < NEBULA_NAVIGATION_REQUIREMENT.minimumExperience
    ? NEBULA_NAVIGATION_REQUIREMENT
    : null;
}
