/** Original map attachment, focus and marker intents. Payment stays host-owned. */
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { RouteView, RoutePhase, RouteErrorKind } from '../../../../src/ui/route-view';
import { eventHasUiInputOwner } from '../../../../src/platform/keyboard/ui-input-ownership';
import { createMapController } from './map-controller';
import { createMapReadModel, isSourceMapFuelRefusal } from './map-read-model';
import { MapArtwork } from './map-artwork';
import { usePresentationClock } from '../use-presentation-clock';
import { getTravelRestriction } from '../../travel-restrictions';

export type MapController = ReturnType<typeof createMapController>;
interface MapPresentationProps {
  readonly controller: MapController;
  readonly route: RouteView | null;
  readonly phase: RoutePhase;
  readonly error: string | null;
  readonly errorRevision: number;
  readonly errorKind: RouteErrorKind | null;
  readonly available: boolean;
  readonly overlay: HTMLElement | null;
  readonly framesPerSecond: number;
  readonly replacedByCommunication?: boolean;
  readonly onDepartTo: (id: number) => void;
  readonly onOpenChange: (open: boolean) => void;
}

export function MapPresentation({ controller, route, phase, error, errorRevision, errorKind,
  available, overlay, framesPerSecond, onDepartTo,
  onOpenChange, replacedByCommunication = false }: MapPresentationProps) {
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const close = useRef<SVGGElement>(null);
  const previousOpen = useRef(false);
  const systemId = useRef(route?.systemId);
  const displayed = useMemo(() => {
    try {
      return { model: route ? createMapReadModel(route, view.hover, view.message) : null, error: null };
    } catch (failure) {
      return { model: null, error: failure instanceof Error ? failure.message : 'Map unavailable' };
    }
  }, [route, view.hover, view.message]);
  const open = view.open && route !== null;

  // Repeated identical refusals must write again after a newer hover writer.
  useEffect(() => {
    if (!error || errorKind !== 'departure') return;
    if (route?.departureStatus === 'rule-refused' && route.destinationSystemId !== null
      && getTravelRestriction(route.destinationSystemId)) {
      controller.travelRestrictionRefusal();
      return;
    }
    if (isSourceMapFuelRefusal(errorKind, route?.departureStatus, route?.destinationSystemId)) controller.fuelRefusal();
  }, [controller, error, errorRevision, errorKind, route?.departureStatus, route?.destinationSystemId]);
  useEffect(() => {
    onOpenChange(open);
    return () => onOpenChange(false);
  }, [open, onOpenChange]);
  useEffect(() => {
    if (systemId.current !== route?.systemId) controller.close();
    systemId.current = route?.systemId;
  }, [controller, route?.systemId]);
  useEffect(() => {
    if (open && available) close.current?.querySelector<SVGGElement>('[role="button"]')?.focus();
    if (!open && previousOpen.current && !replacedByCommunication) overlay?.closest<HTMLElement>('.bm1-game-stage')?.focus();
    previousOpen.current = open;
  }, [open, available, replacedByCommunication, overlay]);
  usePresentationClock(open && available, framesPerSecond, controller.advance);
  useEffect(() => {
    if (!open || !available) return;
    const down = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey
        || event.key.toLowerCase() !== 'q') return;
      const ownControl = event.target instanceof Element
        && event.target.closest('[data-map-scale] [data-source-control]');
      if (eventHasUiInputOwner(event) && !ownControl) return;
      event.preventDefault();
      controller.close();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [open, available, controller]);

  return <>
    {open && error && <p role="alert">{error}</p>}
    {open && phase !== 'ready' && <p role="status">{phase === 'loading' ? 'Loading destination artwork...' : 'Arriving...'}</p>}
    {displayed.error && <p role="alert">Navigation map unavailable: {displayed.error}</p>}
    {overlay && available && open && route && displayed.model && createPortal(
      <MapArtwork route={route} phase={phase} view={view} model={displayed.model}
        controller={controller} closeRef={close} onDepartTo={onDepartTo} />, overlay)}
  </>;
}
