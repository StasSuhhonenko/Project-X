/** Map controls are exposed only after both map and current-vessel travel ink
 * decode. Accepted departure can therefore keep its original audio/pose epoch. */
import type { ComponentProps } from 'react';
import { MapPresentation } from '../map/map-presentation';
import { mapAssets, mapAsset } from '../map/map-content';
import { TravelPresentation } from './travel-presentation';
import { travelContent, travelAsset } from './travel-content';
import { viewportAsset } from '../viewport/viewport-content';

interface NavigationProps {
  readonly map: ComponentProps<typeof MapPresentation>;
  readonly travel: ComponentProps<typeof TravelPresentation>;
  readonly playerDefinitionId: number;
}
export function navigationAssets({ playerDefinitionId }: NavigationProps) {
  const ship = travelContent.ships.find(ship => ship.definitionId === playerDefinitionId);
  return [...mapAssets.map(mapAsset), travelAsset(travelContent.arrival),
    ...travelContent.poses.map(pose => travelAsset(pose.file)),
    ...(ship?.poses.map(pose => travelAsset(pose.file)) ?? []), viewportAsset('viewport-arrival-panel.svg')];
}
export function NavigationPanels({ map, travel }: NavigationProps) {
  return <><MapPresentation {...map} /><TravelPresentation {...travel} /></>;
}
