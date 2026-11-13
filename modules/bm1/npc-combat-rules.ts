/** BM1's two decision leads. Source: Symbol-12-6218.as:12–64 and
 * Symbol-12-11050.as:20–227. The selected lead runs to completion even when
 * it changes alert; a peaceful acquisition cannot fire until the next tick.
 * Sparks are presentation, hit/sticky blame belongs to lifecycle, fleet orders
 * are module-declared live deployment state. None draws from the world stream. Ships and completed
 * stations share this policy; only the source mytype<=69 gates exclude stations. */
import { nextRandomInteger } from '@engine/random/seeded-random';
import {
  NpcTargetResponseSchema,
  type NpcDecision,
  type NpcDecisionContext,
  type NpcPlayerShotContext,
} from '@engine/simulation/contracts/npc-decision-rules';
import { drawInitialTargetSlot, type SourceDraw } from './createship';
import { getProjectileFlight } from './projectile-rules';
import { worldOffsetToSourceStage, worldToSourceStage } from './source-geometry';

/** Sole owner of the source's inclusive flight/weapon strength gate (:103). */
export function hasNpcFlightStrength(percent: number): boolean {
  return percent >= 5;
}

/** Weapon factories provoke ships and stations on accepted emission, including
 * C2 defenders (Page-1-25841.as:254–255,273–274,296–297). Impact never replays it. */
export function respondToPlayerShot(context: NpcPlayerShotContext) {
  return NpcTargetResponseSchema.parse({ targetEntityId: context.playerEntityId, alert: 'combat' });
}

/** Actor-stream adapter. The injectable planner below pins Flash random(n)
 * bounds/order without coupling source branch tests to a particular LCG seed. */
export function decideNpcCombat(context: NpcDecisionContext): NpcDecision {
  let randomState = context.self.randomState;
  const draw: SourceDraw = bound => {
    const step = nextRandomInteger(randomState, bound);
    randomState = step.state;
    return step.value;
  };
  const decision = planNpcCombat(context, draw);
  // The shared decision host validates once, atomically, before applying it.
  return { ...decision, randomState };
}

/** Ordered source policy; all durable output types derive from the engine's
 * Zod contract. Slots include zero and holes; xArray0 is the NEXT allocation
 * cursor (slots.length), not the last valid index. Thus `>` intentionally
 * visits the one-past-end slot before wrapping (both leads :24/:21). */
export function planNpcCombat(context: NpcDecisionContext, draw: SourceDraw): Omit<NpcDecision, 'randomState'> {
  const { self, player, cameraZoom: zoom } = context;
  const combat = { ...self.combat };
  // Page-1-25841.as:347–348 initializes completed stations peaceful/planet.
  // The neutral engine creates null navigation; fill it here before either
  // lead, retaining alert/targets already written by retaliation or an ally.
  let targetEntityId = self.targetEntityId ?? (self.kind === 'station' ? context.planetEntityId : null);
  let targetOffset = self.targetOffset;
  const actorWrites: NpcDecision['actorWrites'][number][] = [];
  // One assignment owner for enmity, rescue and reminders. Source order wins;
  // the host rejects duplicate recipient IDs rather than interpreting them.
  const writeActor = (write: NpcDecision['actorWrites'][number]) => {
    const index = actorWrites.findIndex(candidate => candidate.actorId === write.actorId);
    if (index >= 0) {
      actorWrites[index] = write;
      return;
    }
    actorWrites.push(write);
  };
  const beamShots: NpcDecision['beamShots'][number][] = [];
  const projectileShots: NpcDecision['projectileShots'][number][] = [];
  let departure: NpcDecision['departure'] = null;
  const leave = () => {
    // Symbol-12-26922.as:1–6: departure bypasses death outcomes entirely.
    departure = { code: 'npc-departed', message: 'Sensors indicate a ship has left this system...' };
  };
  let notice: NpcDecision['notice'] = null;
  const finish = () => ({
    combat,
    targetEntityId,
    targetOffset,
    actorWrites,
    beamShots,
    projectileShots,
    departure,
    notice,
  });
  const stage = (position: typeof self.position) => worldToSourceStage(position, player.position, zoom);
  const near = (position: typeof self.position, range: number) => {
    const delta = worldOffsetToSourceStage({ x: position.x - self.position.x, y: position.y - self.position.y }, zoom);
    return Math.abs(delta.x) < range / zoom && Math.abs(delta.y) < range / zoom;
  };
  const peaceful = self.combat.alert === 'peaceful';
  // Symbol-12-155.as:37–42: latch eligibility before this tick's wrap. Once
  // pending it survives cargo changes; delivered never re-arms (port timing).
  // Symbol-12-155.as:12–36 creates station commerce but never hailplayer;
  // only the ship branch :37–46 sets it. Do not synthesize station hails.
  if (self.kind === 'npc-ship' && combat.hail === 'none' && self.hailEligible) combat.hail = 'pending';
  if (peaceful && draw(5000) === 1 && self.kind === 'npc-ship' && self.governmentId !== 16) leave();
  // Combat fade precedes scanning, even below the strength/engine gate
  // (11050:12–16). At alpha100 the source leaves the cloak flag untouched.
  if (!peaceful && combat.opacity < 100) {
    combat.cloaked = false;
    combat.opacity += 5;
  }
  if (combat.scanCursor > context.slotCount) {
    combat.scanCursor = 0;
    if (peaceful && combat.hail === 'pending' && near(player.position, 500)) {
      notice = { code: 'npc-hail', message: `The ${self.name} is hailing you...` };
      combat.hail = 'delivered';
    }
    if (peaceful && self.governmentId === 15 && !player.cloaked) {
      targetEntityId = player.id;
      combat.alert = 'combat';
    }
    // planetArray[1] is the current planet's government, staged as the
    // system governmentId (Page-3-88826.as:25–33), not its definition ID.
    if (
      near(player.position, 1000) &&
      context.localStanding !== null &&
      context.localStanding < 0 &&
      targetEntityId !== player.id &&
      self.governmentId === context.localGovernmentId &&
      !player.cloaked
    ) {
      targetEntityId = player.id;
      combat.alert = 'combat';
    }
  }
  // 6218:46–59 / 11050:32–43 inspect BEFORE increment, including empty slots.
  const candidate = combat.scanCursor === 0 ? null : context.slots[combat.scanCursor];
  if (candidate && candidate.id !== self.id) {
    const own = self.governmentId;
    const other = candidate.governmentId;
    const local = context.localGovernmentId;
    const opposing = context.opposingGovernmentId;
    const enemy =
      other !== null &&
      ((opposing !== null && local !== null && other === opposing && own === local) ||
        (opposing !== null && local !== null && other === local && own === opposing) ||
        (candidate.targetEntityId === player.id && other !== 16 && own === 16) ||
        (other === 15 && own !== 15));
    // Peaceful :50 deliberately omits /zoom; combat :36 includes it. `near`
    // already divides its bound, so multiply only the peaceful bound back.
    if (enemy && near(candidate.position, peaceful ? 800 * zoom : 800)) {
      targetEntityId = candidate.id;
      writeActor({ actorId: candidate.id, targetEntityId: self.id, alert: 'combat' });
      if (peaceful) {
        combat.alert = 'combat';
        notice = { code: 'npc-weapons-fire', message: 'Sensors detect weapons fire in this system...' };
      }
    }
  }
  combat.scanCursor += 1;
  // Retain the delivered peaceful navigation-offset convention: the source's
  // divided values are stored directly as world offsets. Combat uses the same
  // owner, with its larger bound (:105–106); never draw again in navigation.
  const offset = (bound: number) => ({
    x: (draw(bound) - draw(bound)) / zoom,
    y: (draw(bound) - draw(bound)) / zoom,
  });
  if (peaceful) {
    // 6218 has no separate government-16/player steering branch: retain the
    // player target, random dock offsets and ordinary peaceful movement. This
    // escorts locally; the fleet owner handles live orders and travel following.
    if (draw(50) === 1) targetOffset = offset(500);
    // 6218:107–123 follows offsets (:61–64) and peaceful steering (:69–106).
    // Decisions precede the engine movement pass (accepted scheduling adaptation);
    // steering has no cloak consumer and still uses the completed lead's intent.
    if (self.weaponDefinitionIds[2] === 22) {
      if (draw(100) === 1) combat.cloaked = true;
      if (draw(5000) === 1) combat.cloaked = false;
    }
    if (combat.cloaked && combat.opacity >= 5 && self.governmentId !== 16) combat.opacity -= 5;
    if (combat.cloaked && combat.opacity > 25 && self.governmentId === 16) combat.opacity -= 5;
    if (!combat.cloaked && combat.opacity < 100) combat.opacity += 5;
    return finish();
  }
  // 11050:44–69: only the combat lead consumes live orders. The attack
  // random(10) short-circuits BEFORE selected-government inspection. Keep it
  // here, after scanning and before player handling/rescue/navigation draws.
  if (self.governmentId === 16) {
    if (self.orderId === '4' && draw(10) === 1) {
      const selected = context.slots.find(slot => slot?.id === player.selectedTargetEntityId);
      if (selected?.governmentId !== 16) targetEntityId = player.selectedTargetEntityId;
    }
    if (
      self.orderId === '3' &&
      (targetEntityId === null || targetEntityId === player.id || targetEntityId === context.planetEntityId)
    ) {
      // xArray0 is the allocation cursor: scan 1..<cursor, keeping the LAST
      // match, without distance restrictions or random draws.
      context.slots.slice(1, context.slotCount).forEach(slot => {
        if (!slot) return;
        const localEnemy =
          slot.governmentId === context.localGovernmentId &&
          context.localStanding !== null &&
          context.localStanding < 0;
        const opposingEnemy =
          slot.governmentId === context.opposingGovernmentId &&
          context.localStanding !== null &&
          context.localStanding > 50;
        if (localEnemy || opposingEnemy || slot.governmentId === 15) targetEntityId = slot.id;
      });
    }
    if (targetEntityId === null) {
      targetEntityId = context.planetEntityId;
      combat.alert = 'peaceful';
    }
  }
  // :72–76 changes intent but does NOT abort the combat lead.
  if (targetEntityId === player.id) {
    if (player.cloaked) {
      targetEntityId = context.planetEntityId;
      combat.alert = 'peaceful';
    }
    // 11050:77–80 is inside the original player-target guard, so the warning
    // also follows a cloaked-player retarget above. Alert changes do not abort
    // this lead; the existing scheduling contract selects peaceful next tick.
    if (self.governmentId === 16) {
      notice = { code: 'fleet-player-warning', message: 'Captain, what are you doing?!?!?' };
      combat.alert = 'peaceful';
    }
  }
  // :84–102 rescue copies MY target, even planet, to one on-screen ally.
  if (self.governmentId === context.localGovernmentId || self.governmentId === context.opposingGovernmentId) {
    const ally = context.slots[combat.rescueCursor];
    if (ally && ally.id !== self.id && ally.governmentId === self.governmentId) {
      const screen = stage(ally.position);
      if (screen.x > 0 && screen.x < 600 && screen.y > 0 && screen.y < 450)
        writeActor({ actorId: ally.id, targetEntityId, alert: 'combat' });
    }
    combat.rescueCursor += 1;
    if (combat.rescueCursor > context.slotCount) combat.rescueCursor = 0;
  }
  // :103 uses scalar station strength, combined ship durability. The engine
  // supplies that projection; condition is not a station's strength owner.
  if (!hasNpcFlightStrength(self.strengthPercent) || self.engineDisabledFrames > 0) return finish();
  if (draw(50) === 1) targetOffset = offset(800);
  if (draw(100) === 1) targetOffset = { x: 0, y: 0 };
  if (typeof combat.primaryWeaponTimer === 'number' && combat.primaryWeaponTimer > 0) combat.primaryWeaponTimer -= 1;
  if (typeof combat.secondaryWeaponTimer === 'number' && combat.secondaryWeaponTimer > 0)
    combat.secondaryWeaponTimer -= 1;
  // :125–134 capture BEFORE fallback. numstations is the cached pre-encounter
  // cursor (Page-1-25841.as:355), NOT the current scan bound. The helper owns
  // the same coin/conditional slot draw as C10a; selection is then overwritten.
  const capturedTarget =
    targetEntityId === player.id
      ? player.position
      : targetEntityId === context.planetEntityId
        ? context.planetPosition
        : context.slots.find(slot => slot?.id === targetEntityId)?.position;
  if (!capturedTarget || targetEntityId === context.planetEntityId) {
    drawInitialTargetSlot(draw, context.entryActorSlotCount);
    targetEntityId = context.planetEntityId;
    combat.alert = 'peaceful';
  }
  // :137–145 has no ship-only gate: stations also receive writes. Merge duplicate
  // rescue/reminder writes: later source assignment wins, one engine write/ID.
  const remind = () => {
    const target = context.slots.find(slot => slot?.id === targetEntityId);
    if (!target || target.id === self.id) return;
    writeActor({ actorId: target.id, targetEntityId: self.id, alert: 'combat' });
  };
  if (draw(10) === 1) remind();
  if (draw(20) === 1 && self.governmentId === 16) remind();
  // Original field3: ship sizeClass / structure constructionScale
  // (stage.cjs:144,166; shared actorSize adapter). Timer normalization must
  // never replace original field3 as the damage basis (11050:175,189,216).
  const sizeFactor = self.sizeClass >= 6 ? 1 : self.sizeClass;
  const ready = (timer: typeof combat.primaryWeaponTimer) =>
    timer === null || (typeof timer === 'number' && timer <= 0);
  const installTimer = (weaponId: number | null | undefined) => {
    const weapon = weaponId ? context.getWeaponDefinition(weaponId) : undefined;
    return weapon ? weapon.cooldownFrames * (6 - sizeFactor) : 'inert';
  };
  // 11050:192–196,219–222 uses captured, UNOFFSET target coordinates.
  // source-geometry's linear vector inverse divides both axes by zoom;
  // headings remain clockwise from up, identical to engine world headings.
  const exactAim = (target: typeof self.position) => {
    const delta = worldOffsetToSourceStage({ x: target.x - self.position.x, y: target.y - self.position.y }, zoom);
    return Math.round((Math.atan2(delta.y, delta.x) * 180) / Math.PI) + 90;
  };
  const launch = (weaponId: number, rotationDegrees: number) => {
    // Weapon26 has no source flight profile (Reman53; C16). Retain timer,
    // offsets and draws but emit nothing rather than inventing a projectile.
    if (!getProjectileFlight(weaponId) || !targetEntityId) return;
    projectileShots.push({
      weaponDefinitionId: weaponId,
      targetEntityId,
      rotationDegrees,
      // speed is world units/source tick (4909:38–39). C4 moves in world
      // units; source-geometry's projection supplies the source /zoom.
      launchSpeedPerFrame: self.speedPerFrame,
    });
  };
  if (ready(combat.primaryWeaponTimer) && capturedTarget && near(capturedTarget, 300)) {
    // itemdesc field11 -> startingWeaponIds[0]; weaponstats field6 ->
    // cooldownFrames (stage.cjs:152–154,189). No NPC energy/ammo debit.
    let weaponId = self.weaponDefinitionIds[0];
    if (draw(200) === 1 && self.kind === 'npc-ship' && self.governmentId !== 16 && !weaponId) leave();
    // User decision 2026-11-07: keep the first fallback for the visit, saved.
    // Source 11050:161–164 draws AFTER random200 and BEFORE timer/scatter.
    if (!weaponId && self.kind === 'station') {
      if (combat.fallbackPrimaryWeaponId === null) combat.fallbackPrimaryWeaponId = draw(13) + 1;
      weaponId = combat.fallbackPrimaryWeaponId;
    }
    // :170 installs Number(undefined)*factor = NaN for weapon 0. This timeline
    // value persists: neither >0 nor <=0/undefined succeeds again. The generic
    // inert state preserves that lifetime and JSON roundtrip without NaN.
    // :166–169 reuse the timeline strafe variable `x` for the cooldown size
    // factor (`var x = size; if (x >= 6) x = 1`). That write is unconditional
    // in this block and persists, so the next frames steer with x = factor
    // until a strafe redraw/reset or the torpedo branch below zeroes it. It
    // follows the delivered convention of storing source offsets directly.
    targetOffset = { x: sizeFactor, y: targetOffset.y };
    combat.primaryWeaponTimer = installTimer(weaponId);
    if (weaponId && weaponId <= 5 && targetEntityId) beamShots.push({ weaponDefinitionId: weaponId, targetEntityId });
    if (weaponId && weaponId >= 6) {
      targetOffset = { x: 0, y: 0 };
      combat.strafing = true;
      const scatteredHeading = self.rotationDegrees + draw(20) - draw(20);
      launch(weaponId, self.kind === 'station' ? exactAim(capturedTarget) : scatteredHeading);
    }
  }
  // 11050:204–227: install BEFORE range/nonzero tests, even for absent w0.
  // Like the primary :166–170, x is also the persistent strafe offset; this
  // secondary write follows and survives primary torpedo zeroing. No draws.
  if (ready(combat.secondaryWeaponTimer)) {
    const weaponId = self.weaponDefinitionIds[1];
    targetOffset = { x: sizeFactor, y: targetOffset.y };
    combat.secondaryWeaponTimer = installTimer(weaponId);
    if (weaponId && capturedTarget && near(capturedTarget, 2000)) launch(weaponId, exactAim(capturedTarget));
  }
  return finish();
}
