/** BM1 C13 source policy. The engine owns offers, inventory, atomic payment,
 * standing, stable identity and completion transitions. C14 settlement effects
 * are deliberately absent. Source citations refer to analysis/bm1/scripts/. */
import { z } from 'zod';
import { nextRandomInteger } from '@engine/random/seeded-random';
import {
  ConstructedStationServicesSchema,
  type ConstructionRules,
} from '@engine/simulation/contracts/construction-rules';
import raw from './construction-data.json';

/** Validate the maintained recovery projection once at the module boundary.
 * Every nested returned service array is readonly; callers cannot mutate the
 * shared defaults. Balance comes only from the supplied structure definition. */
const ConstructionDataSchema = z
  .object({
    stationNames: z.array(z.string().min(1)).length(20).readonly(),
    destinationNames: z.record(z.string().regex(/^[1-9][0-9]*$/), z.string().min(1)).readonly(),
    stations: z
      .array(
        z
          .object({
            structureId: z.number().int().min(70).max(90),
            mnemonic: z.string().min(1),
            sourceOffers: z.array(z.number().int().positive()).length(6).readonly(),
            services: ConstructedStationServicesSchema,
          })
          .strict()
          .readonly()
      )
      .length(21)
      .readonly(),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.stations.some((station, index) => station.structureId !== index + 70)) {
      context.addIssue({ code: 'custom', path: ['stations'], message: 'Expected ordered station types70-90.' });
    }
    if (Object.keys(data.destinationNames).some(key => Number(key) > 55)) {
      context.addIssue({
        code: 'custom',
        path: ['destinationNames'],
        message: 'Destination exceeds source range1-55.',
      });
    }
  })
  .readonly();
const data = ConstructionDataSchema.parse(raw);

/** Presentation-only stream: exactly random(20), then random(50), never world
 * RNG. Page-3-88826.as:18-19; Symbol-3-108813.as:5-13. Intent carries the result. */
export function proposeStationName(seed: number): string {
  const prefix = nextRandomInteger(seed, 20);
  const suffix = nextRandomInteger(prefix.state, 50);
  return data.stationNames[prefix.value] + '-' + suffix.value;
}

/** Literal map labels, including exceptional entries49-51. There are no source
 * names52-55: do not invent labels/routes from currently supported systems. */
export const constructionDestinationNames: Readonly<Partial<Record<number, string>>> = data.destinationNames;
export const initialConstructionDestination = 1;

/** Symbol-3-77698.as:1-10 and Symbol-3-78076.as:1-10: wrap first, then reset an
 * undefined label to1. Previous from1 wraps55 and therefore also resets to1. */
export function stepConstructionDestination(systemId: number, direction: -1 | 1): number {
  if (!Number.isInteger(systemId) || systemId < 1 || systemId > 55) {
    throw new Error('Construction destination must be an integer in1-55.');
  }
  if (direction !== -1 && direction !== 1) throw new Error('Construction direction must be -1 or1.');
  const candidate = systemId + direction;
  const wrapped = candidate < 1 ? 55 : candidate > 55 ? 1 : candidate;
  return constructionDestinationNames[wrapped] === undefined ? 1 : wrapped;
}

/** The legacy type ID is also used by the hail route (Page-1-25841.as:988-993). */
export function isWormholeGenerator(structureId: number): boolean {
  return structureId === 85;
}

/** Symbol-3-108813.as:7-13: hidden text does not disable the arrows. */
export function isConstructionDestinationHidden(structureId: number): boolean {
  return isWormholeGenerator(structureId);
}

export const construction: ConstructionRules = Object.freeze<ConstructionRules>({
  planCapacity: 9,
  evaluatePlanPurchase(context) {
    // Symbol-3-99010.as:42-45 uses full root priceadjust, not C5's half-adjusted
    // equipment formula. Existing equipment market owns that realized value;
    // null means no installed adjustment, just as Fleet's ordinary B+A quote.
    const amount = context.structure.basePrice + (context.marketAdjustment ?? 0);
    return { price: { resourceId: 'latinum', amount }, accepted: (context.resources.latinum ?? 0) >= amount };
  },
  evaluateStart(context) {
    // Symbol-3-108813.as:20-21,61-67: unclaimed refuses BEFORE checking ore.
    // The shared content boundary normalizes source government0 to null.
    if (context.localGovernmentId === null) {
      return {
        kind: 'refused',
        notice: {
          code: 'construction-unclaimed',
          message: 'You cannot build a station in a system that is not claimed by a government.',
        },
      };
    }
    const amount = context.structure.basePrice / 10;
    if ((context.resources.deuranium ?? 0) < amount) {
      return {
        kind: 'refused',
        notice: { code: 'construction-insufficient', message: 'You do not have sufficient deuranium to build this...' },
      };
    }
    // Symbol-3-108813.as:26,29,52-59: debit once through engine settlement;
    // exact balance succeeds, plans remain reusable and prestige is not capped.
    const standingDelta = context.localGovernmentId === 16 ? 0 : 2 * context.structure.constructionScale;
    return {
      kind: 'accepted',
      cost: { resourceId: 'deuranium', amount },
      initialProgress: -context.structure.constructionScale * 100,
      standingDelta,
      notice: {
        code: 'construction-started',
        message:
          context.localGovernmentId === 16
            ? 'Construction of your station has begun.'
            : 'You build a station in this system for this government and they are extremely thankful. Prestige increases by ' +
              standingDelta +
              '%.',
      },
    };
  },
  placeStation(context) {
    // Symbol-3-108813.as:30-33: player-minus-planet, then ONE random(360).
    // Use the same nextRandomInteger world adapter as Fleet; no name draw here.
    const rotation = nextRandomInteger(context.randomState, 360);
    return {
      positionOffset: {
        x: context.playerPosition.x - context.planetPosition.x,
        y: context.playerPosition.y - context.planetPosition.y,
      },
      rotationDegrees: rotation.value,
      randomState: rotation.state,
    };
  },
  travelProgress(context) {
    // Page-1-81455.as:107-110 adds raw dist, not floored calendar days.
    return context.durationDays;
  },
  completionNotice(context) {
    // Page-1-81455.as:111 (recovery calls this the110 transition): class uses
    // itemdesc name, not the alternate stationtypes presentation labels.
    return {
      code: 'construction-complete',
      message:
        'Station ' +
        context.name +
        ', a ' +
        context.structure.name +
        ' in the ' +
        context.system.name +
        ' system has completed construction.',
    };
  },
  stationServices(structureId) {
    // Symbol-3-108813.as:34-39; Page-1-25841.as:339-344. Staging shares the
    // authored station conversion; runtime does not reimplement offer rules.
    const row = data.stations.find(station => station.structureId === structureId);
    if (!row) throw new Error('Unsupported construction structure: ' + structureId);
    return row.services;
  },
});
