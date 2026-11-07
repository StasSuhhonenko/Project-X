/**
 * Gameplay preparation sets, all held through the shared artwork store.
 *
 * - HUD artwork gates the HUD itself: every HUD section plane (so switching
 *   sections never waits), viewport ink, death frames and equipment icons.
 * - Local preparation covers interactions the system exposes (contacts, nested
 *   panels, tactical portraits, navigation) plus their lazily split code. It
 *   gates the initial scene reveal, never the HUD after reveal.
 * - Tactical artwork for the current target gates only the tactical panel, so a
 *   newly arrived NPC with an unseen portrait cannot hide the whole HUD.
 */
import { useEffect, useRef, useState } from 'react';
import type { EquipmentView } from '@engine/ui/equipment-view';
import { equipmentAsset, equipmentContent } from './equipment/equipment-content';
import { hudAsset, hudContent } from './hud/hud-content';
import type { LocalPreparationInput } from './local-preparation';
import { localPanels, localPreparation } from './panel-loaders';
import { actorExplosionAsset, actorExplosionAssets } from './tactical/actor-explosion';
import { tacticalPanelAssets } from './tactical/tactical-content';
import type { TacticalReadModel } from './tactical/tactical-read-model';
import { useArtwork, type ArtworkReadiness } from './use-artwork';
import { viewportAsset, viewportContent } from './viewport/viewport-content';

interface HudArtworkRequest {
  readonly equipment: EquipmentView | null;
  readonly weaponDefinitionId: number | null;
}

export function hudArtworkAssets(request: HudArtworkRequest = { equipment: null, weaponDefinitionId: null }) {
  const ids = [
    ...(request.equipment?.channels.map(channel => channel.weaponDefinitionId) ?? []),
    ...(request.equipment?.owned.map(item => item.weaponDefinitionId) ?? []),
  ];
  const weapon = viewportContent.weapons.find(weapon => weapon.id === request.weaponDefinitionId);
  return [
    ...hudContent.planes.map(plane => hudAsset(plane.asset)),
    viewportAsset('viewport-top.svg'),
    viewportAsset('viewport-minimap.svg'),
    ...actorExplosionAssets.map(actorExplosionAsset),
    ...equipmentContent.icons.filter(icon => ids.includes(icon.id)).map(icon => equipmentAsset(icon.file)),
    ...(!request.equipment && weapon ? [viewportAsset(weapon.file)] : []),
  ];
}

/** Tactical panel ink for the displayed target model, or nothing. */
export const tacticalModelAssets = (model: TacticalReadModel | null) => (model ? tacticalPanelAssets(model.asset) : []);

export function useHudArtwork(request: HudArtworkRequest) {
  // Removing an item must not make existing art unavailable in the exact tick
  // that starts its closing effect. Retain visited ink for this scene; the
  // store releases it when this system/session presentation unmounts.
  const prepared = useRef<readonly string[]>([]);
  prepared.current = [...new Set([...prepared.current, ...hudArtworkAssets(request)])];
  return useArtwork(prepared.current);
}

/** Failure dominates, then readiness requires every part. */
export function combinedReadiness(...parts: readonly ArtworkReadiness[]): ArtworkReadiness {
  if (parts.some(part => part === 'failed')) return 'failed';
  if (parts.every(part => part === 'ready')) return 'ready';
  return 'loading';
}

const localCodeReady = () =>
  localPreparation.current() !== null && localPanels.every(panel => panel.current() !== null);

/**
 * Prepare local interaction code and artwork for `input` (null holds nothing).
 * Already prepared sets report `ready` in the same render. Failures stay local
 * and retryable; the caller decides what they block.
 */
export function useLocalPreparation(input: LocalPreparationInput | null) {
  const [code, setCode] = useState<ArtworkReadiness>(() => (localCodeReady() ? 'ready' : 'loading'));
  const [attempt, setAttempt] = useState(0);
  const requested = input !== null;
  useEffect(() => {
    if (!requested || localCodeReady()) return;
    let current = true;
    setCode('loading');
    void Promise.all([localPreparation.load(), ...localPanels.map(panel => panel.load())]).then(
      () => {
        if (current) setCode('ready');
      },
      () => {
        if (current) setCode('failed');
      }
    );
    return () => {
      current = false;
    };
  }, [requested, attempt]);
  const module = code === 'ready' ? localPreparation.current() : null;
  const assets = module && input ? module.localInteractionAssets(input) : [];
  const artwork = useArtwork(assets, module !== null && input !== null);
  return {
    ready: requested ? combinedReadiness(code, artwork.ready) : 'ready',
    retry: () => {
      if (code === 'failed') setAttempt(value => value + 1);
      artwork.retry();
    },
  };
}
