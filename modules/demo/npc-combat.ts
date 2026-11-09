/** Independently authored warning patrol. A negative district standing makes
 * settlement traffic challenge an uncloaked surveyor within a circular radius.
 * Its nonlethal pulse uses the demo's shield-only hit policy and a fixed cadence,
 * with none of the compatibility module's scan/range/size timing rules. */
import { nextRandomUnit } from '@engine/random/seeded-random';
import type {
  NpcDecision,
  NpcDecisionContext,
  NpcPlayerShotContext,
  NpcTargetResponse,
} from '@engine/simulation/contracts/npc-decision-rules';

export function decideNpcCombat(context: NpcDecisionContext): NpcDecision | null {
  const { self, player } = context;
  // A courier leaves its final marker when damaged; platforms reply with the
  // same survey marker. This example uses no recovered timing or weapon rules.
  const markerActor =
    (self.kind === 'station' && self.targetEntityId !== player.id) || self.weaponDefinitionIds[0] === 102;
  if (markerActor && self.combat.alert === 'combat' && self.targetEntityId !== null) {
    const timer = self.combat.primaryWeaponTimer;
    const fire = timer === null || (typeof timer === 'number' && timer <= 0);
    const target =
      self.targetEntityId === player.id
        ? player.position
        : (context.slots.find(slot => slot?.id === self.targetEntityId)?.position ?? context.planetPosition);
    return {
      combat: { ...self.combat, primaryWeaponTimer: fire ? 20 : typeof timer === 'number' ? timer - 1 : timer },
      targetEntityId: self.targetEntityId,
      targetOffset: self.targetOffset,
      randomState: self.randomState,
      actorWrites: [],
      beamShots: [],
      projectileShots: fire
        ? [
            {
              weaponDefinitionId: 102,
              targetEntityId: self.targetEntityId,
              rotationDegrees: (Math.atan2(target.x - self.position.x, self.position.y - target.y) * 180) / Math.PI,
              launchSpeedPerFrame: 0,
            },
          ]
        : [],
      departure:
        self.kind === 'npc-ship' && self.strengthPercent < 25
          ? { code: 'survey-departure', message: 'The courier leaves its final survey marker and returns to base.' }
          : null,
      notice: null,
    };
  }
  if (self.kind === 'station') return null;
  // Independent traffic arbitration: larger survey craft challenge another
  // government within a circular radius, without slot cursors or paired writes.
  const rival =
    self.sizeClass >= 2
      ? context.slots.find(
          slot =>
            slot?.kind === 'npc-ship' &&
            slot.id !== self.id &&
            slot.governmentId !== self.governmentId &&
            Math.hypot(slot.position.x - self.position.x, slot.position.y - self.position.y) < 160
        )
      : null;
  if (rival) {
    const timer = self.combat.primaryWeaponTimer;
    const ready = timer !== 'inert' && (timer ?? 0) <= 0 && self.engineDisabledFrames === 0;
    return {
      combat: {
        ...self.combat,
        alert: 'combat',
        primaryWeaponTimer: ready ? 8 : timer === 'inert' ? timer : timer! - 1,
      },
      targetEntityId: rival.id,
      targetOffset: self.targetOffset,
      randomState: self.randomState,
      projectileShots: [],
      departure: null,
      actorWrites: [],
      beamShots: ready ? [{ weaponDefinitionId: 101, targetEntityId: rival.id }] : [],
      notice: null,
    };
  }
  const inRange = Math.hypot(self.position.x - player.position.x, self.position.y - player.position.y) < 160;
  const acquired =
    self.governmentId !== context.localGovernmentId &&
    context.localStanding !== null &&
    context.localStanding < 0 &&
    inRange &&
    !player.cloaked;
  const combat = acquired || (self.combat.alert === 'combat' && self.targetEntityId === player.id && !player.cloaked);
  // Shared saved timers may be permanently inert; preserve that channel state.
  const timer =
    self.combat.primaryWeaponTimer === 'inert' ? 'inert' : Math.max(0, (self.combat.primaryWeaponTimer ?? 0) - 1);
  const weapon = context.getWeaponDefinition(101);
  const fire = combat && inRange && timer === 0 && self.engineDisabledFrames === 0 && weapon !== undefined;
  // Each active challenge consumes only its actor stream; peaceful traffic keeps
  // its stream. The draw is a cosmetic-free challenge sequence, saved on actor.
  const randomState = combat ? nextRandomUnit(self.randomState).state : self.randomState;
  return {
    combat: { ...self.combat, alert: combat ? 'combat' : 'peaceful', primaryWeaponTimer: fire ? 8 : timer },
    targetEntityId: combat ? player.id : self.targetEntityId,
    targetOffset: self.targetOffset,
    randomState,
    projectileShots: [],
    departure: null,
    actorWrites: [],
    beamShots: fire ? [{ weaponDefinitionId: weapon!.id, targetEntityId: player.id }] : [],
    notice:
      acquired && self.combat.alert === 'peaceful'
        ? { code: 'patrol-warning', message: 'A settlement patrol challenges your survey clearance.' }
        : null,
  };
}

/** Every accepted targeted survey pulse provokes the victim immediately. */
export function respondToPlayerShot(context: NpcPlayerShotContext): NpcTargetResponse {
  return { targetEntityId: context.playerEntityId, alert: 'combat' };
}
