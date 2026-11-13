/** C9 policy only: the engine owns rewards, fleet identity and death settlement.
 * Evidence and intentional timeline/stream adaptations: C9_BOARDING_RECOVERY.md.
 * No browser, renderer, live actor mutation or independent standing state. */
import { WeaponDefinitionSchema } from '@engine/content/schemas/game-content';
import { nextRandomInteger } from '@engine/random/seeded-random';
import type { BoardingContext, BoardingResult, BoardingRules } from '@engine/simulation/contracts/boarding-rules';
import type { Position } from '@engine/simulation/model/entity-components';
import { missionData } from './mission-data';
import moduleData from './public/game/module.json';
import { rotatedHullBounds, worldOffsetToSourceStage, worldToSourceStage } from './source-geometry';

// Reuse the reviewed C5 catalogue, rather than maintaining a second weapon/name/
// size table. The current boarding contract supplies hulls but no weapon lookup.
const weapons = WeaponDefinitionSchema.array().readonly().parse(moduleData.content.weaponDefinitions);

/** Source's strict stage-centre test; shared by policy and cosmetic cue input. */
export function inBoardingBeamRange(targetPosition: Position, playerPosition: Position, zoom: number): boolean {
  const stage = worldToSourceStage(targetPosition, playerPosition, zoom);
  return Math.abs(stage.x - 298) < 20 && Math.abs(stage.y - 195) < 20;
}

export const boardingMessages = Object.freeze({
  beam: 'Your team beams over to the disabled ship. Burned corpses litter the decks and they pilage what valuables they can find.',
  pillage: (amount: number) =>
    `    Your away team transports to the ship and takes what latinum they can find. They narrowly return as the ship self-destructs. You happily count the ${amount} bars of latinum you have stolen from this vessel.`,
  salvage: (name: string) => `    Your away team salvages a ${name} from this ship just before it self-destructs.`,
  tooSmall: (name: string) =>
    `Your away team tries to salvage a ${name} from this ship but your ship is too small. The ship explodes from the attempt.`,
  capture: 'Your away team manages to capture the enemy vessel and has taken it to the planet for repairs.',
  experience:
    'Your away team attempts to capture this ship, but their lack of experience causes them to trigger the self-destruct. 100+ Engineering and 100+ Away Team experience required.',
  size: 'Your away team tries to capture this ship but its crew overpowers them and activates the self destruct. You needed a larger ship with more crew to capture a ship of this size.',
});

/** Injectable integer draws expose source bounds/order to recovery tests; the
 * production adapter below advances only the boarded NPC's saved stream. */
export function resolveBoardingWithDraw(
  context: BoardingContext,
  draw: (bound: number) => number
): Omit<BoardingResult, 'randomState'> {
  let standingDelta = 0;
  if (context.targetGovernmentId === 12 || context.targetGovernmentId === context.localGovernmentId)
    standingDelta -= draw(5);
  // Independent source if: both draws occur when local and opposing coincide.
  if (context.targetGovernmentId === context.opposingGovernmentId) standingDelta += draw(5);
  const amount = draw(500) + context.targetVessel.sizeClass * 20;
  const finish = (outcome: BoardingResult['outcome'], message: string) => ({
    outcome,
    message,
    standingDelta,
    selfDestruct: outcome.kind !== 'capture',
  });
  if (draw(6) < 3) return finish({ kind: 'pillage', resourceId: 'latinum', amount }, boardingMessages.pillage(amount));
  const weaponId = context.targetVessel.startingWeaponIds[draw(2)];
  // Source short-circuit: an empty hull column does not draw random(3).
  if (weaponId && draw(3) < 2) {
    const weapon = weapons.find(item => item.id === weaponId);
    if (!weapon) throw new Error(`Boarding hull references unknown weapon ${weaponId}.`);
    if (context.playerVessel.sizeClass < weapon.minimumSizeClass)
      return finish({ kind: 'salvage', weaponDefinitionId: null }, boardingMessages.tooSmall(weapon.name));
    // The C5 operation installs into the first empty position. Full slots silently
    // lose the salvage but retain the success text, exactly as the source.
    return finish({ kind: 'salvage', weaponDefinitionId: weaponId }, boardingMessages.salvage(weapon.name));
  }
  if (context.playerVessel.sizeClass < context.targetVessel.sizeClass)
    return finish({ kind: 'failed-capture' }, boardingMessages.size);
  const experience = context.progression?.experience;
  if ((experience?.['away-team'] ?? 0) < 100 || (experience?.engineering ?? 0) < 100)
    return finish({ kind: 'failed-capture' }, boardingMessages.experience);
  // D8: alreadyOwned deliberately returns the same result; the C11 owner skips
  // allocation on an already-linked actor. No name draw or funds/staffing gate.
  return finish({ kind: 'capture' }, boardingMessages.capture);
}

export const boarding: BoardingRules = Object.freeze<BoardingRules>({
  beamOverMessage: boardingMessages.beam,
  assessBoarding(context) {
    const inBeamRange = inBoardingBeamRange(context.targetPosition, context.playerPosition, context.cameraZoom);
    if (
      context.targetDefinitionId > 69 ||
      context.targetMaximumStrength <= 0 ||
      (context.targetStrength / context.targetMaximumStrength) * 100 >= 5
    )
      return { inBeamRange, eligible: false };
    const player = missionData.entities.find(item => item.id === context.playerDefinitionId);
    const target = missionData.entities.find(item => item.id === context.targetDefinitionId);
    if (!player || !target) return { inBeamRange, eligible: false };
    const playerBounds = rotatedHullBounds(
      player.width,
      player.height,
      context.playerHeadingDegrees,
      context.cameraZoom
    );
    const targetBounds = rotatedHullBounds(
      target.width,
      target.height,
      context.targetHeadingDegrees,
      context.cameraZoom
    );
    const delta = worldOffsetToSourceStage(
      {
        x: context.targetPosition.x - context.playerPosition.x,
        y: context.targetPosition.y - context.playerPosition.y,
      },
      context.cameraZoom
    );
    return {
      inBeamRange,
      eligible:
        Math.abs(delta.x) <= (playerBounds.width + targetBounds.width) / 2 &&
        Math.abs(delta.y) <= (playerBounds.height + targetBounds.height) / 2,
    };
  },
  resolveBoarding(context) {
    let randomState = context.randomState;
    const outcome = resolveBoardingWithDraw(context, bound => {
      const step = nextRandomInteger(randomState, bound);
      randomState = step.state;
      return step.value;
    });
    return { ...outcome, randomState };
  },
});
