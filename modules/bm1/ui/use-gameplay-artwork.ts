import { equipmentAssets, equipmentAsset } from './equipment/equipment-content';
/** Required scene artwork has one lifetime: failure blocks authored controls,
 * retry replaces every decode, and disposal invalidates pending completions. */
import { useEffect, useState } from 'react';
import { hudAsset, hudContent } from './hud/hud-content';
import { tacticalAsset, tacticalAssets } from './tactical/tactical-content';
import { contactAsset, contactAssets } from './contact/contact-content';
import { repairAsset, repairAssets } from './repair/repair-content';
import { mapAsset, mapAssets } from './map/map-content';
import { travelAsset, travelAssets } from './travel/travel-content';
import { actorExplosionAsset, actorExplosionAssets } from './tactical/actor-explosion';
import { communicationAsset, communicationAssets } from './communication/communication-content';
import { viewportAsset, viewportAssets } from './viewport/viewport-content';
import { shipyardAsset, shipyardAssets } from './shipyard/shipyard-content';

/** The module owns this full required set, including initially hidden panels.
 * The host viewport's spatial assets retain their separate readiness owner. */
const assets = [
  ...hudContent.planes.map(plane => hudAsset(plane.asset)),
  ...tacticalAssets.map(tacticalAsset), ...contactAssets.map(contactAsset),
  ...repairAssets.map(repairAsset), ...mapAssets.map(mapAsset),
  ...travelAssets.map(travelAsset), ...actorExplosionAssets.map(actorExplosionAsset),
  ...communicationAssets.map(communicationAsset),
  ...viewportAssets.map(viewportAsset),
  ...shipyardAssets.map(shipyardAsset),
  ...equipmentAssets.map(equipmentAsset),
];

/** Starts one decode attempt and returns its disposer. Both successful and
 * failed stale promises are ignored after disposal, including across retry. */
export function decodeGameplayArtwork(onReady: () => void, onFailure: () => void) {
  let current = true;
  const images = assets.map(asset => {
    const image = new Image();
    image.src = asset;
    return image;
  });
  void Promise.all(images.map(image => image.decode())).then(
    () => { if (current) onReady(); },
    () => { if (current) onFailure(); },
  );
  return () => {
    current = false;
    images.forEach(image => { image.src = ''; });
  };
}

export function useGameplayArtwork() {
  const [ready, setReady] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setReady('loading');
    return decodeGameplayArtwork(() => setReady('ready'), () => setReady('failed'));
  }, [attempt]);
  return { ready, retry: () => setAttempt(value => value + 1) };
}
