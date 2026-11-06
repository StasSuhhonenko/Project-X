/** Visible HUD readiness; deferred panels own their preparation at point of use. */
import { useRef } from 'react';
import type { EquipmentView } from '@engine/ui/equipment-view';
import { equipmentAsset, equipmentContent } from './equipment/equipment-content';
import { hudAsset, hudContent } from './hud/hud-content';
import { actorExplosionAsset, actorExplosionAssets } from './tactical/actor-explosion';
import { tacticalAsset, tacticalContent } from './tactical/tactical-content';
import type { TacticalReadModel } from './tactical/tactical-read-model';
import { decodeArtwork, useArtwork } from './use-artwork';
import { viewportAsset, viewportContent } from './viewport/viewport-content';

interface GameplayArtworkRequest {
  readonly planeAsset: string;
  readonly tactical: TacticalReadModel | null;
  readonly equipment: EquipmentView | null;
  readonly includeOwnedEquipment: boolean;
  readonly weaponDefinitionId: number | null;
}
const initial = {
  planeAsset: hudContent.planes[0]!.asset,
  tactical: null,
  equipment: null,
  includeOwnedEquipment: false,
  weaponDefinitionId: null,
};

export function gameplayArtworkAssets(request: GameplayArtworkRequest = initial) {
  const ids = request.equipment?.channels.map(channel => channel.weaponDefinitionId) ?? [];
  const owned = request.includeOwnedEquipment
    ? (request.equipment?.owned.map(item => item.weaponDefinitionId) ?? [])
    : [];
  const weapon = viewportContent.weapons.find(weapon => weapon.id === request.weaponDefinitionId);
  return [
    hudAsset(request.planeAsset),
    viewportAsset('viewport-top.svg'),
    viewportAsset('viewport-minimap.svg'),
    ...actorExplosionAssets.map(actorExplosionAsset),
    ...equipmentContent.icons
      .filter(icon => [...ids, ...owned].includes(icon.id))
      .map(icon => equipmentAsset(icon.file)),
    ...(!request.equipment && weapon ? [viewportAsset(weapon.file)] : []),
    ...(request.tactical
      ? [tacticalContent.background, tacticalContent.disabled, tacticalContent.arrow, request.tactical.asset].map(
          tacticalAsset
        )
      : []),
  ];
}

/** Starts one decode attempt and returns its disposer. Both successful and
 * failed stale promises are ignored after disposal, including across retry. */
export function decodeGameplayArtwork(onReady: () => void, onFailure: () => void) {
  return decodeArtwork(gameplayArtworkAssets(), onReady, onFailure);
}

export function useGameplayArtwork(request: GameplayArtworkRequest = initial) {
  // Removing a selection must not make existing art unavailable in the exact
  // tick that starts its death/closing effect. Retain visited ink for this scene;
  // the decode owner releases it all when this system/session unmounts.
  const prepared = useRef<readonly string[]>([]);
  prepared.current = [...new Set([...prepared.current, ...gameplayArtworkAssets(request)])];
  return useArtwork(prepared.current);
}
