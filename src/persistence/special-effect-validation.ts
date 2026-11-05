import { supportsSavedLaunch } from './equipment-validation';
/** Content-aware save validation for captured effects and their continuations. */
import { pulseProgressAtAge } from '../simulation/model/pulse-progression';
import type { GameModule } from '../content/game-module';
import { isEarlierRuntimeEntityId } from '../simulation/model/entity-components';
import { getSpecialWeapon, selectSpecialScanSlots } from '../simulation/features/special-weapons';
import { pulseResetSlot, replayPulseCursor } from '../simulation/model/pulse-scan';
import type { WorldState } from '../simulation/model/world-state';

export function validateSavedSpecialEffects(world: WorldState, gameModule: GameModule): void {
  const { catalog, definition, rules } = gameModule;
  const stationPrefix = world.lifecycle.stationSpawnSlots
    ?? [null, ...world.entities.filter(entity => entity.kind === 'station').map(entity => entity.id)];
  const roster = world.specialActorSlots;
  const mobileIds = world.entities.filter(entity => entity.kind === 'npc-ship').map(entity => entity.id);
  const mobileSlots = roster.slice(stationPrefix.length).filter((id): id is string => id !== null);
  const allocationNumbers = mobileSlots.map(id => Number(id.slice('entity-'.length)));
  if (stationPrefix.some((id, index) => roster[index] !== id)
    || mobileSlots.length !== mobileIds.length || mobileIds.some(id => !mobileSlots.includes(id))
    || allocationNumbers.some((sequence, index) => index > 0 && sequence <= allocationNumbers[index-1]!)
    || roster.length > world.nextEntitySequence)
    throw Error('Saved special actor roster differs from canonical station or mobile allocation order.');
  const devices = definition.content.weaponDefinitions.map(weapon => getSpecialWeapon(rules, weapon.id));
  const pulses = devices.filter(device => device?.kind === 'pulse');
  const maximumDisable = Math.max(0, ...pulses.map(device => device.policy.engineDisableFrames));
  const maximumNpcHitFlag = Math.max(0, ...pulses.map(device => device.policy.hitFlagAmount));
  const maximumPlayerHitFlag = Math.max(0, ...pulses.map(device => device.policy.playerHitFlagAmount));
  world.entities.forEach(entity => {
    if (entity.kind !== 'npc-ship' && entity.kind !== 'player-ship') return;
    if (entity.specialStatus.engineDisabledFrames > maximumDisable
      || entity.specialStatus.hitFlag > (entity.kind === 'player-ship' ? maximumPlayerHitFlag : maximumNpcHitFlag)
      || (entity.specialStatus.cloaked && !devices.some(device => device?.kind === 'cloak')))
      throw Error('Saved actor special status exceeds available module capabilities.');
  });
  world.specialEffects.forEach(effect => {
    const supported = getSpecialWeapon(rules, effect.weaponDefinitionId);
    if (!supported || supported.kind !== effect.kind
      || !catalog.getWeaponDefinition(effect.weaponDefinitionId)
      || !supportsSavedLaunch(gameModule, effect.emitterDefinitionId, effect.weaponDefinitionId)
      || !definition.visuals.specialEffects.some(visual => visual.id === effect.visualId && visual.kind === effect.kind))
      throw Error('Saved special effect capability is unavailable.');
    if (effect.visualId !== supported.visualId || JSON.stringify(effect.policy) !== JSON.stringify(supported.kind === 'pulse' ? supported.policy : supported))
      throw Error('Saved special effect policy differs from the supported launch policy.');
    if (effect.kind === 'tractor') {
      if (effect.ageTicks >= effect.policy.maximumAgeTicks) throw Error('Saved tractor has expired.');
      // A missing target remains historical. A future allocator ID could later
      // become a different actor and would silently turn absence into retargeting.
      if (!isEarlierRuntimeEntityId(effect.targetEntityId,effect.id)) throw Error('Saved tractor target did not exist before emission.');
      const target = world.entities.find(entity => entity.id === effect.targetEntityId);
      if (target && target.kind !== 'npc-ship' && target.kind !== 'station') throw Error('Saved tractor target is invalid.');
      return;
    }
    if (supported.kind !== 'pulse') throw Error('Saved pulse policy has invalid kind.');
    const policy = effect.policy;
    const { scalePercent: expectedScale, alphaPercent: expectedAlpha } = pulseProgressAtAge(policy, effect.ageTicks);
    if (Math.abs(effect.scalePercent-expectedScale) > 1e-7 || Math.abs(effect.alphaPercent-expectedAlpha) > 1e-7
      || effect.alphaPercent < policy.minimumAlphaPercent)
      throw Error('Saved pulse scale or alpha does not match its age.');
    if (effect.cursor === null && effect.ageTicks > 0)
      throw Error('Saved pulse cursor cannot remain undefined after a lead.');
    const stationSlotCount = world.lifecycle.stationSpawnSlots?.length
      ?? world.entities.filter(entity => entity.kind === 'station').length+1;
    const segments = effect.scanSegments;
    const lastSegment = segments[segments.length-1];
    const currentSlotCount = selectSpecialScanSlots(world,rules).length;
    if ((effect.ageTicks === 0 && segments.length !== 0)
      || (effect.ageTicks > 0 && (segments[0]?.firstAgeTick !== 1 || lastSegment?.slotCount !== currentSlotCount))
      || segments.some((segment,index) => segment.firstAgeTick > effect.ageTicks
        || (index > 0 && (segment.firstAgeTick <= segments[index-1]!.firstAgeTick
          || segment.slotCount <= segments[index-1]!.slotCount))))
      throw Error('Saved pulse scan span witness is inconsistent.');
    const expectedCursor = replayPulseCursor(policy,supported.initialCursor,effect.ageTicks,
      pulseResetSlot(policy,stationSlotCount),segments);
    if (effect.cursor !== expectedCursor) throw Error('Saved pulse cursor does not match its exact scan continuation.');
    if (effect.ageTicks === 0 && (effect.cursor !== supported.initialCursor
      || effect.scalePercent !== policy.initialScalePercent || effect.alphaPercent !== 100))
      throw Error('Saved new pulse differs from its launch state.');
  });
}
