/** Original player-relative repair attachment. Commands are host intents;
 * this component never prices or heals. */
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { GameplayPresentationProps } from '../../../../src/ui/gameplay-presentation';
import { createRepairController, repairPose, repairScale, REPAIR_LAST_FRAME } from './repair-controller';
import { repairAsset, repairContent, REPAIR_LAYOUT as layout } from './repair-content';
import { SourceControl } from '../source-control';
import { usePresentationClock } from '../use-presentation-clock';

type RepairProps = Pick<GameplayPresentationProps, 'repair' | 'playerSpatial' | 'onCancelRepair'> & {
  readonly available: boolean; readonly framesPerSecond: number; readonly overlay: HTMLElement | null;
};
/** Owns only local attachment playback/focus. Overlay lifetime follows active
 * repair; unmount, asset failure and scene replacement never issue cancellation. */
export function RepairPresentation({ repair, playerSpatial, onCancelRepair, available, framesPerSecond, overlay }: RepairProps) {
  const controller = useMemo(createRepairController, []);
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const cancel = useRef<SVGGElement>(null);
  const wasRepairing = useRef(false);
  const opener = useRef<Element | null>(null);
  useEffect(() => controller.reset(), [repair.repairing, controller]);
  useEffect(() => {
    if (repair.repairing && !wasRepairing.current) {
      // A source contact opener is removed before this effect. Its lost focus
      // becomes body, which is not a usable restoration target.
      opener.current = document.activeElement === document.body ? null : document.activeElement;
    }
    if (repair.repairing && available) cancel.current?.querySelector<SVGGElement>('[role="button"]')?.focus();
    if (!repair.repairing && wasRepairing.current) {
      if (opener.current?.isConnected && 'focus' in opener.current) (opener.current as HTMLElement).focus();
      if (!opener.current?.isConnected) overlay?.closest<HTMLElement>('.bm1-game-stage')?.focus();
    }
    wasRepairing.current = repair.repairing;
  }, [repair.repairing, available, controller, overlay]);
  usePresentationClock(repair.repairing && available && view.frame < REPAIR_LAST_FRAME, framesPerSecond, controller.advance);
  const pose = repairPose(view.frame);
  const scale = repairScale(playerSpatial.boundsWidth, playerSpatial.boundsHeight);
  const bounds = repairContent.cancel;
  return <>
    {overlay && available && repair.repairing && createPortal(<svg className="bm1-hud-stage bm1-repair-stage" viewBox={`0 0 ${layout.stageWidth} ${layout.stageHeight}`} width={layout.stageWidth} height={layout.stageHeight}
      aria-label="Repair attachment" data-repair-frame={view.frame} data-repair-pose={pose.frame} data-repair-heading={playerSpatial.headingDegrees}>
      <g transform={`translate(${playerSpatial.x} ${playerSpatial.y}) rotate(${playerSpatial.headingDegrees}) scale(${scale.x} ${scale.y})`}>
        <image href={repairAsset(pose.file)} x={-layout.fixtureX} y={-layout.fixtureY} width={layout.stageWidth} height={layout.stageHeight} />
        <g ref={cancel}><SourceControl control={{ scriptOffset: 3671, name: '', depth: 7, artwork: null,
          paths: [`M${bounds.left},${bounds.top} H${bounds.right} V${bounds.bottom} H${bounds.left} Z`] }} label="Cancel spatial repair" onActivate={onCancelRepair} /></g>
      </g>
    </svg>, overlay)}
  </>;
}
