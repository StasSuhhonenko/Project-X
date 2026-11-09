/** Primary-slot special dispatch and ordered field settlement. Definitions are
 * validated before eligibility so malformed trusted policy fails atomically. */
import type { ShipDefinition, WeaponDefinition } from '../../content/schemas/game-content';
import type { GameModuleDefinition } from '../../content/schemas/game-module';
import type { GameRules } from '../contracts/game-rules';
import type { ProgressionEvent } from '../contracts/progression-rules';
import {
  SpecialEffectSlotsSchema,
  SpecialWeaponDefinitionSchema,
  type SpecialWeaponDefinition,
} from '../contracts/special-weapon-rules';
import { entityCombatGeometry } from '../geometry/combat-geometry';
import { specialEffectBounds } from '../geometry/effect-geometry';
import { canUseOwnedWeapon } from '../model/equipment-state';
import type { PlayerMovementState } from '../model/player-state';
import { pulseProgressAtAge } from '../model/pulse-progression';
import { pulseResetSlot, pulseScanEnd, pulseScanStart } from '../model/pulse-scan';
import {
  SpecialEffectStateSchema,
  type ActorSpecialStatus,
  type SpecialEffectState,
} from '../model/special-effect-state';
import { freezeWorld } from '../model/world-schema';
import {
  selectPlayerEntity,
  selectSelectedWorldTarget,
  type PrimaryWeaponState,
  type WorldState,
} from '../model/world-state';

export interface SpecialWeaponTick {
  /** Accepted command only; the tick host settles it before publication. */
  readonly progressionEvent?: Omit<Extract<ProgressionEvent, { kind: 'weapon-fire' }>, 'progression' | 'randomState'>;
  readonly playerMovement: PlayerMovementState;
  readonly armament: PrimaryWeaponState;
  readonly specialEmission?: SpecialEffectState | null;
  readonly specialStatus?: ActorSpecialStatus;
}

/** Free decloak is evaluated independently of energy. Every paid action checks
 * its entire debit before committing, including intentionally paid no-effects. */
export function updateSpecialWeapon(
  world: WorldState,
  player: PlayerMovementState,
  vessel: ShipDefinition,
  weapon: WeaponDefinition,
  requested: boolean,
  zoom: number,
  rules: GameRules,
  definition: SpecialWeaponDefinition,
  armament: PrimaryWeaponState = selectPlayerEntity(world).armament
): SpecialWeaponTick {
  const current = selectPlayerEntity(world);
  const unchanged = {
    playerMovement: player,
    armament: { ...armament, cooldownRemainingFrames: Math.max(0, armament.cooldownRemainingFrames - 1) },
  };
  if (
    !requested ||
    armament.cooldownRemainingFrames > 0 ||
    (current.equipment ? !canUseOwnedWeapon(vessel, weapon) : vessel.sizeClass < weapon.minimumSizeClass)
  )
    return unchanged;
  const disabling = definition.kind === 'cloak' && current.specialStatus.cloaked;
  if (current.specialStatus.cloaked && definition.kind !== 'cloak') return unchanged;
  const cost = disabling ? 0 : weapon.energyCost * definition.energyDebitMultiplier;
  if (!Number.isFinite(cost)) throw Error('Special weapon debit overflow.');
  if (cost > player.energy) return unchanged;
  const target = selectSelectedWorldTarget(world);
  if (definition.kind === 'tractor' && !target) return unchanged;
  const approval = rules.evaluatePrimaryFire({
    player: {
      position: player.position,
      energy: player.energy,
      repairing: player.repairing,
      flightMode: player.flightMode,
    },
    vessel: { sizeClass: vessel.sizeClass },
    weapon: { id: weapon.id, energyCost: cost, cooldownFrames: weapon.cooldownFrames },
    target: target
      ? {
          position: target.location.position,
          kind: target.kind,
          ...(target.kind === 'station' && target.combat ? { stationRecordId: target.combat.recordId } : {}),
        }
      : null,
    cameraZoom: zoom,
  });
  if (!approval) return unchanged;
  const cooldown = approval.cooldownFramesBeforeEndOfTick;
  if (!Number.isFinite(cooldown) || cooldown < 0 || cooldown > 100000) throw Error('Invalid special weapon cooldown.');
  const sequence = armament.shotSequence + 1;
  const nextArmament = {
    ...armament,
    shotSequence: sequence,
    resolvedShotSequence: sequence,
    cooldownRemainingFrames: Math.max(0, cooldown - 1),
    lastAcceptedShot: {
      sequence,
      weaponDefinitionId: weapon.id,
      targetEntityId: target?.id ?? null,
      tick: world.tick + 1,
    },
  };
  const common = {
    id: `entity-${world.nextEntitySequence}`,
    emitterEntityId: current.id,
    emitterDefinitionId: current.definitionId,
    weaponDefinitionId: weapon.id,
    systemId: current.location.systemId,
    origin: player.position,
    spawnedTick: world.tick + 1,
    ageTicks: 0,
  };
  const range = definition.kind === 'tractor' ? definition.range : undefined;
  const inRange =
    !range ||
    (target !== null &&
      (['x', 'y'] as const).every(coordinate => {
        const denominator = range.space === 'stage' ? zoom : 1;
        const distance =
          (target.location.position[coordinate] - player.position[coordinate]) / denominator -
          range.originOffset[coordinate] -
          (range.originOffsetPerZoom?.[coordinate] ?? 0) / zoom;
        if (!Number.isFinite(distance)) throw Error('Tractor range geometry overflow.');
        return Math.abs(distance) < range.perAxis;
      }));
  const specialEmission =
    definition.kind === 'pulse'
      ? SpecialEffectStateSchema.parse({
          ...common,
          origin: {
            x: player.position.x + (definition.emissionOffset?.x ?? 0),
            y: player.position.y + (definition.emissionOffset?.y ?? 0),
          },
          kind: 'pulse',
          effectDefinitionId: definition.effectDefinitionId,
          policy: definition.policy,
          cursor: definition.initialCursor,
          scalePercent: definition.policy.initialScalePercent,
          alphaPercent: 100,
        })
      : definition.kind === 'tractor' && inRange
        ? SpecialEffectStateSchema.parse({
            ...common,
            kind: 'tractor',
            effectDefinitionId: definition.effectDefinitionId,
            targetEntityId: target!.id,
            policy: definition,
          })
        : null;
  return {
    ...(!disabling
      ? {
          progressionEvent: {
            kind: 'weapon-fire' as const,
            weaponDefinitionId: weapon.id,
            channel: 'special' as const,
          },
        }
      : {}),
    playerMovement: { ...player, energy: player.energy - cost },
    armament: nextArmament,
    specialEmission,
    specialStatus: {
      ...current.specialStatus,
      hitFlag: 0,
      engineDisabledFrames: Math.max(0, current.specialStatus.engineDisabledFrames - 1),
      cloaked: definition.kind === 'cloak' ? !current.specialStatus.cloaked : current.specialStatus.cloaked,
    },
  };
}

function overlaps(
  effect: SpecialEffectState,
  target: WorldState['entities'][number],
  visuals: GameModuleDefinition['combatGeometry']
): boolean {
  if (target.kind !== 'station' && target.kind !== 'npc-ship' && target.kind !== 'player-ship') return false;
  const visual = visuals.specialEffects.find(candidate => candidate.id === effect.effectDefinitionId);
  const actor = visuals.entities.find(candidate => candidate.entityDefinitionId === target.definitionId);
  if (!visual || !actor) throw Error('Special effect collision visual is unavailable.');
  const a = specialEffectBounds(effect, visual);
  if (!a) return false;
  const size = entityCombatGeometry(visuals, target.definitionId, target.kind === 'player-ship').size;
  const radians = (target.location.rotationDegrees * Math.PI) / 180,
    cos = Math.cos(radians),
    sin = Math.sin(radians);
  const points = [
    [0, 0],
    [size.width, 0],
    [size.width, size.height],
    [0, size.height],
  ].map(([x, y]) => {
    const dx = x! - actor.pivot.x * size.width,
      dy = y! - actor.pivot.y * size.height;
    return { x: target.location.position.x + dx * cos - dy * sin, y: target.location.position.y + dx * sin + dy * cos };
  });
  return (
    a.left <= Math.max(...points.map(point => point.x)) &&
    a.right >= Math.min(...points.map(point => point.x)) &&
    a.top <= Math.max(...points.map(point => point.y)) &&
    a.bottom >= Math.min(...points.map(point => point.y))
  );
}

/** Sequential reduction preserves allocation-order overlaps/standing updates.
 * New emissions wait one tick; movement decrements statuses before this refresh. */
export function advanceSpecialEffects(
  world: WorldState,
  rules: GameRules,
  visuals: GameModuleDefinition['combatGeometry'] | undefined
): WorldState {
  if (!world.specialEffects.length || world.status !== 'active') return world;
  if (!visuals) throw Error('Special effect visuals are unavailable.');
  return world.specialEffects.reduce((state, previous) => {
    if (previous.spawnedTick === state.tick) return state;
    const ageTicks = state.tick - previous.spawnedTick;
    const replace = (effect: SpecialEffectState | null, candidate = state) =>
      freezeWorld({
        ...candidate,
        specialEffects: candidate.specialEffects.flatMap(current =>
          current.id !== previous.id ? [current] : effect ? [effect] : []
        ),
      });
    if (previous.kind === 'tractor') {
      const policy = previous.policy;
      if (ageTicks >= policy.maximumAgeTicks) return replace(null);
      const active =
        ageTicks >= policy.firstResetAgeTicks &&
        ageTicks < policy.firstResetAgeTicks + policy.resetIntervalTicks * policy.resetCount &&
        (ageTicks - policy.firstResetAgeTicks) % policy.resetIntervalTicks === 0;
      return replace(
        { ...previous, ageTicks },
        active
          ? {
              ...state,
              entities: state.entities.map(entity =>
                entity.id === previous.targetEntityId && entity.kind === 'npc-ship'
                  ? { ...entity, motion: { ...entity.motion, speedPerFrame: 0 } }
                  : entity
              ),
            }
          : state
      );
    }
    const policy = previous.policy;
    const { scalePercent, alphaPercent } = pulseProgressAtAge(policy, ageTicks);
    if (alphaPercent < policy.minimumAlphaPercent) return replace(null);
    const effect = SpecialEffectStateSchema.parse({ ...previous, ageTicks, scalePercent, alphaPercent });
    if (effect.kind !== 'pulse') throw Error('Pulse policy changed kind.');
    const slots = selectSpecialScanSlots(state, rules);
    const scanSegments = effect.scanSegments;
    const lastSegment = scanSegments[scanSegments.length - 1];
    if (lastSegment && slots.length < lastSegment.slotCount) throw Error('Special scan roster cannot shrink.');
    const nextSegments =
      lastSegment?.slotCount === slots.length
        ? scanSegments
        : [...scanSegments, { firstAgeTick: ageTicks, slotCount: slots.length }];
    const stationSlotCount =
      state.lifecycle.stationSpawnSlots?.length ??
      state.entities.filter(entity => entity.kind === 'station').length + 1;
    let cursor = pulseScanStart(
      policy,
      effect.cursor,
      ageTicks,
      slots.length,
      pulseResetSlot(policy, stationSlotCount)
    );
    // Source consumers deliberately do not wrap inside a multi-slot lead.
    // This bounded loop preserves undefined first-query and increment ordering.
    let candidate = state;
    for (let scan = 0; scan < policy.scanCountPerTick; scan += 1) {
      const targetId = cursor === null ? null : (slots[cursor] ?? null);
      const target = candidate.entities.find(entity => entity.id === targetId);
      if (target && overlaps(effect, target, visuals)) {
        candidate = {
          ...candidate,
          entities: candidate.entities.map(entity =>
            entity.id === target.id && entity.kind === 'npc-ship'
              ? {
                  ...entity,
                  combat: { ...entity.combat, cloaked: policy.reveal ? false : entity.combat.cloaked },
                  specialStatus: {
                    ...entity.specialStatus,
                    engineDisabledFrames: policy.engineDisableFrames || entity.specialStatus.engineDisabledFrames,
                    hitFlag: policy.hitFlagAmount || entity.specialStatus.hitFlag,
                  },
                }
              : entity
          ),
          lifecycle: {
            ...candidate.lifecycle,
            systemStanding: candidate.lifecycle.systemStanding.map(entry =>
              entry.systemId === effect.systemId
                ? { ...entry, value: entry.value + policy.standingDeltaPerOverlap }
                : entry
            ),
          },
        };
      }
      const player = selectPlayerEntity(candidate);
      if (policy.playerHitFlagAmount > 0 && overlaps(effect, player, visuals))
        candidate = {
          ...candidate,
          entities: candidate.entities.map(entity =>
            entity.kind === 'player-ship'
              ? { ...entity, specialStatus: { ...entity.specialStatus, hitFlag: policy.playerHitFlagAmount } }
              : entity
          ),
        };
      cursor = pulseScanEnd(cursor, 1);
    }
    return replace(SpecialEffectStateSchema.parse({ ...effect, cursor, scanSegments: nextSegments }), candidate);
  }, world);
}

/** One shared validation entry for trusted policies used at dispatch/restore. */
export function getSpecialWeapon(
  rules: Pick<GameRules, 'getSpecialWeapon'>,
  id: number
): SpecialWeaponDefinition | null {
  const input = rules.getSpecialWeapon?.(id);
  return input == null ? null : SpecialWeaponDefinitionSchema.parse(input);
}

/** Validate the module's focused projection once for runtime and save replay. */
export function selectSpecialScanSlots(world: WorldState, rules: GameRules): readonly (string | null)[] {
  if (!rules.selectSpecialEffectSlots) throw Error('Special scan roster policy is unavailable.');
  const slots = SpecialEffectSlotsSchema.parse(
    rules.selectSpecialEffectSlots(
      Object.freeze({
        actorSpawnSlots: world.specialActorSlots,
        stationSpawnSlots: world.lifecycle.stationSpawnSlots,
        actors: Object.freeze(
          world.entities
            .filter(entity => entity.kind === 'npc-ship')
            .map(actor => Object.freeze({ id: actor.id, generation: actor.generation }))
        ),
      })
    )
  );
  const liveIds = new Set(
    world.entities.filter(entity => entity.kind === 'npc-ship' || entity.kind === 'station').map(entity => entity.id)
  );
  const ids = slots.filter((id): id is string => id !== null);
  if (new Set(ids).size !== ids.length || ids.some(id => !liveIds.has(id)))
    throw Error('Special scan roster is invalid.');
  return slots;
}
