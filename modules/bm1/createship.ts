/** Single owner of the draws shared by every source `createship()` call
 * (Page-1-25841.as:388–481): the `shipdefaults` roster with setallied/setenemy
 * (:597–623), the generated name (:440–449), the stage position (:458–459) and
 * the initial-target coin (:473–477). C2 generated defenders and C10a visit
 * encounters both build ships through these functions, so their draw order
 * cannot diverge. Callers own the branch logic around them. */
import { z } from 'zod';
import raw from './encounter-data.json';
import { lifecycleMetadata, ordinaryLifecycleMetadata } from './lifecycle-content';

const ShipDefaultsDataSchema = z
  .object({
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    sourceFile: z.string().min(1),
    shipDefaults: z
      .array(
        z
          .object({
            governmentIndex: z.number().int().nonnegative(),
            raceId: z.number().int().positive().nullable(),
            roster: z.array(z.number().int().positive()).readonly(),
          })
          .strict()
          .readonly()
      )
      .length(16)
      .readonly(),
    /** Ship types with maintained visuals/geometry; staged from the same facts. */
    spawnableShipDefinitionIds: z.array(z.number().int().positive()).readonly(),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.shipDefaults.some((row, index) => row.governmentIndex !== index))
      context.addIssue({ code: 'custom', message: 'Roster rows must be indexed by government.' });
  })
  .readonly();

const data = ShipDefaultsDataSchema.parse(raw);
const shipDefaults = data.shipDefaults;
const spawnable = new Set(data.spawnableShipDefinitionIds);

/** False for ship types the runtime cannot place (no recovered artwork/geometry). */
export function isSpawnableShip(definitionId: number): boolean {
  return spawnable.has(definitionId);
}

/** Validate a createship(-1) identity against the same complete roster owner
 * used to draw it, including the source's absent-roster fallback (:597–610). */
export function isAlliedShipIdentity(
  governmentIndex: number,
  definitionId: number,
  raceId: number,
  name: string
): boolean {
  const row = shipDefaults[governmentIndex] ?? shipDefaults[0]!;
  const valid = row.roster.length > 0 && row.raceId !== null;
  const race = valid ? row.raceId! : 1;
  const matches = valid ? row.roster.includes(definitionId) : definitionId >= 1 && definitionId <= 23;
  return (
    matches &&
    raceId === race &&
    lifecycleMetadata.names.includes(name.slice(namePrefixForRace(race).length)) &&
    name.startsWith(namePrefixForRace(race))
  );
}

/** Source race prefixes applied to generated names (Page-1-25841.as:441–449). */
const NAME_PREFIXES: Readonly<Record<number, string>> = Object.freeze({ 2: 'ISS ', 3: 'IKC ', 5: 'RES ' });

export function namePrefixForRace(raceId: number): string {
  return NAME_PREFIXES[raceId] ?? '';
}

/** A source draw `random(bound)`: an integer in [0, bound). */
export type SourceDraw = (bound: number) => number;

export interface RosterShip {
  readonly definitionId: number;
  readonly raceId: number;
}

/** setallied/setenemy for one government index (0 when the source value is
 * absent). Always draws `random(i)+1` over the roster, where an empty roster
 * still draws `random(1)`; when the pick is absent or non-positive the source
 * falls back to `random(23)+1` with race 1. */
export function selectRosterShip(governmentIndex: number, draw: SourceDraw): RosterShip {
  const row = shipDefaults[governmentIndex] ?? shipDefaults[0]!;
  const picked = row.roster[draw(Math.max(row.roster.length, 1))];
  if (picked !== undefined && picked > 0 && row.raceId !== null) return { definitionId: picked, raceId: row.raceId };
  return { definitionId: draw(23) + 1, raceId: 1 };
}

/** Source name draw `shipnamesArray[random(219)+1]`: the maintained name table
 * holds source indices 1..219, so the draw indexes it directly. */
export function selectRawShipName(draw: SourceDraw): string {
  const name = lifecycleMetadata.names[draw(lifecycleMetadata.names.length)];
  if (!name) throw new Error('Invalid reviewed ship-name table.');
  return name;
}

/** Ordinary createship adds the race prefix; Fleet purchase uses the raw draw. */
export function selectShipName(raceId: number, draw: SourceDraw): string {
  return namePrefixForRace(raceId) + selectRawShipName(draw);
}

/** Stage-coordinate position `random(5000)-random(5000)` for x, then y; the left
 * operand is drawn first. Callers convert stage coordinates to world space. */
export function drawStagePosition(draw: SourceDraw): Readonly<{ x: number; y: number }> {
  const x = draw(5000) - draw(5000);
  const y = draw(5000) - draw(5000);
  return { x, y };
}

/** Initial target `random(2) == 1 and numstations > 0` → `otherships[random(numstations)]`,
 * else the planet. `slotCount` is the cached actor-slot cursor (source
 * `numstations`), which includes the empty slot 0 and holes: an empty slot leaves
 * the ship without a target and is never rerolled. Returns the slot index, or
 * null for the planet. The coin is always drawn. */
export function drawInitialTargetSlot(draw: SourceDraw, slotCount: number): number | null {
  const coin = draw(2);
  if (coin !== 1 || slotCount <= 0) return null;
  return draw(slotCount);
}

// C2's preserved government profiles carry their own roster/race/prefix copy.
// Reconcile once at load so the two staged artefacts can never drift apart.
ordinaryLifecycleMetadata.governmentProfiles.forEach(profile => {
  const row = shipDefaults[profile.governmentId];
  if (
    !row ||
    row.raceId !== profile.raceId ||
    row.roster.join(',') !== profile.roster.join(',') ||
    namePrefixForRace(profile.raceId) !== profile.namePrefix
  )
    throw new Error(`C2 government profile ${profile.governmentId} differs from the source roster.`);
});
