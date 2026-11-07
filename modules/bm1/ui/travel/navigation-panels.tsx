/** Map controls are exposed only after both map and current-vessel travel ink
 * decode. Accepted departure can therefore keep its original audio/pose epoch. */
import type { ComponentProps } from 'react';
import { mapAsset, mapAssets } from '../map/map-content';
import { MapPresentation } from '../map/map-presentation';
import { viewportAsset } from '../viewport/viewport-content';
import { travelAsset, travelContent } from './travel-content';
import { TravelPresentation } from './travel-presentation';

interface NavigationProps {
  readonly map: ComponentProps<typeof MapPresentation>;
  readonly travel: ComponentProps<typeof TravelPresentation>;
  readonly playerDefinitionId: number;
}
export function navigationAssets({ playerDefinitionId }: NavigationProps) {
  return navigationVesselAssets(playerDefinitionId);
}
/** Map and travel ink for one player vessel; shared with local preparation. */
export function navigationVesselAssets(playerDefinitionId: number) {
  const ship = travelContent.ships.find(ship => ship.definitionId === playerDefinitionId);
  return [
    ...mapAssets.map(mapAsset),
    travelAsset(travelContent.arrival),
    ...travelContent.poses.map(pose => travelAsset(pose.file)),
    ...(ship?.poses.map(pose => travelAsset(pose.file)) ?? []),
    viewportAsset('viewport-arrival-panel.svg'),
  ];
}
export function NavigationPanels({ map, travel }: NavigationProps) {
  return (
    <>
      <MapPresentation {...map} />
      <TravelPresentation {...travel} />
    </>
  );
}
