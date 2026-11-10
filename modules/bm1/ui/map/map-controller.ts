/** UI-only attachment and source 20 percent/frame growth; world routes remain host-owned. */
import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import { MAP_LAYOUT as layout } from './map-layout';

const ViewSchema = z
  .object({
    open: z.boolean(),
    scale: z.number().min(layout.initialScale).max(layout.maximumScale),
    hover: z.number().int().min(1).max(50).nullable(),
    message: z.enum(['current', 'navigation-error', 'fuel-refusal', 'travel-restriction']),
    rotation: z.number().finite(),
    alpha: z.number().finite(),
    fade: z.boolean(),
    fleetFrame: z.number().int().min(0).max(1),
    fleetAlpha: z.number().min(10).max(100),
    fleetFade: z.boolean(),
  })
  .strict()
  .readonly();

export function createMapController() {
  const initial = {
    open: false,
    scale: layout.initialScale,
    hover: null,
    message: 'current' as const,
    rotation: 0,
    alpha: 100,
    fade: true,
    fleetFrame: 0,
    fleetAlpha: 100,
    fleetFade: true,
  };
  const store = createStore(() => ViewSchema.parse(initial));
  const commit = (view: z.input<typeof ViewSchema>) => store.setState(ViewSchema.parse(view), true);
  return Object.freeze({
    getSnapshot: store.getState,
    subscribe: (listener: () => void) => store.subscribe(listener),
    open: () => commit({ ...initial, open: true }),
    close: () => commit(initial),
    hover: (id: number | null) => commit({ ...store.getState(), hover: id, message: 'current' }),
    currentError: () => commit({ ...store.getState(), message: 'navigation-error' }),
    fuelRefusal: () => commit({ ...store.getState(), message: 'fuel-refusal' }),
    travelRestrictionRefusal: () => commit({ ...store.getState(), message: 'travel-restriction' }),
    advance: () => {
      const v = store.getState();
      if (!v.open) return;
      let alpha = v.alpha;
      let fade = v.fade;
      // Symbol3:44353 has independent if branches; the lower reversal adds
      // ten in the same frame and the upper reversal may reach alpha110.
      if (fade) {
        alpha -= 10;
        if (alpha < 50) fade = false;
      }
      if (!fade) {
        alpha += 10;
        if (alpha > 100) fade = true;
      }
      let fleetAlpha = v.fleetAlpha;
      let fleetFade = v.fleetFade;
      // Symbol-3-96376.as:6-8 attaches only at full scale. Symbol-311-1559.as:4-18
      // and Symbol-311-2869.as:2-15 pulse 100..10 with independent guards (lower reversal adds
      // ten immediately); its two authored graphics frames alternate.
      if (v.scale === layout.maximumScale) {
        if (fleetFade) {
          fleetAlpha -= 10;
          if (fleetAlpha < 10) fleetFade = false;
        }
        if (!fleetFade) {
          fleetAlpha += 10;
          if (fleetAlpha > 90) fleetFade = true;
        }
      }
      commit({
        ...v,
        scale: Math.min(layout.maximumScale, v.scale + layout.growthPerFrame),
        rotation: (v.rotation + 20) % 360,
        alpha,
        fade,
        fleetAlpha,
        fleetFade,
        fleetFrame: v.scale === layout.maximumScale ? 1 - v.fleetFrame : 0,
      });
    },
  });
}
