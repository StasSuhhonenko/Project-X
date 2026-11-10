/** UI-12 writers from Symbol-6-52531.as:12–82. Ownership/fleet/population
 * are explicit inputs supplied by their owning views. */
import type { ProgressionDefinition, ProgressionState } from '@engine/simulation/model/progression-state';
import type { FleetView } from '@engine/ui/fleet-view';
import type { SystemStandingView } from '@engine/ui/system-standing-view';

/** Symbol-6-52531.as:72-78 counts nonzero roster entries. C11 removes sold/
 * dead rows, so every projected entry counts, including ships in other systems.
 * The caller places this plain integer in exp2's fourth newline-terminated row. */
export const fleetStatisticsCount = (fleet: FleetView | null | undefined): number => fleet?.ships.length ?? 0;

/** Page-1-25841.as:180–186 floors AFTER summing and dividing by fixed 55.
 * SWF6 Number(undefined) contributes zero; short authored arrays stay short. */
export function galacticPrestige(standing: readonly SystemStandingView[]): number {
  return Math.floor(
    standing.filter(entry => entry.systemId >= 1 && entry.systemId <= 55).reduce((sum, entry) => sum + entry.value, 0) /
      55
  );
}

/** Strict maximum preserves the first source tally on ties. Population titles
 * override career and prestige titles last, including the strict >5 boundary. */
export function statusTitle(
  definition: ProgressionDefinition,
  captain: ProgressionState | null,
  prestige: number,
  population: number
): string {
  const best = definition.tallies.reduce<{ label: string; value: number }>(
    (best, tally) => {
      const value = captain?.tallies[tally.id] ?? 0;
      return value > best.value ? { label: tally.label, value } : best;
    },
    { label: 'Insignificant', value: 10 }
  );
  let title = best.label;
  if (prestige > 100) title = 'Galactic Hero';
  if (prestige < 0) title = 'Galactic Criminal';
  if (population > 5 && population < 15) return 'Colonist';
  if (population >= 15 && population < 25) return 'Leader';
  if (population >= 25 && population < 35) return 'Governor';
  if (population >= 35 && population < 45) return 'Head of State';
  if (population >= 45 && population < 55) return 'Emperor';
  if (population >= 55) return 'Galactic Emperor';
  return title;
}

export function createStatusReadModel(
  definition: ProgressionDefinition | undefined,
  captain: ProgressionState | null,
  standing: readonly SystemStandingView[],
  ownedSystems: number,
  fleet: number,
  population: number
) {
  if (!definition) return { exp1: '', exp2: '' };
  const prestige = galacticPrestige(standing);
  return Object.freeze({
    // Source exp1 has separators only; exp2 terminates every line.
    exp1: definition.skills.map(skill => Math.floor(captain?.experience[skill.id] ?? 0)).join('\n'),
    exp2: `${prestige}%\n${statusTitle(definition, captain, prestige, population)}\n${ownedSystems}\n${fleet}\n${population} billion\n`,
  });
}
