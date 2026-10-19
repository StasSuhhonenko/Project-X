/** Neutral deterministic uint32 stream shared by independent state owners. */
import { z } from 'zod';

export const UInt32Schema = z.number().int().min(0).max(0xffffffff);
export type UInt32 = z.infer<typeof UInt32Schema>;

export interface RandomStep {
  readonly state: UInt32;
  /** Unit interval value derived from the new state. */
  readonly value: number;
}

const UINT32_RANGE = 0x100000000;

export function isUInt32(value: number): value is UInt32 {
  return Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}

/** Advance the sole LCG implementation once and return a value in [0, 1). */
export function nextRandomUnit(state: number): RandomStep {
  if (!isUInt32(state)) throw new Error('Random state must be a uint32.');
  const next = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return { state: next, value: next / UINT32_RANGE };
}

/** Advance once and scale the same unit value to an integer bound. */
export function nextRandomInteger(
  state: number,
  exclusiveMaximum: number,
): RandomStep {
  if (!isUInt32(state)) throw new Error('Random state must be a uint32.');
  if (!Number.isInteger(exclusiveMaximum) || exclusiveMaximum <= 0) {
    throw new Error('Random bound must be positive.');
  }
  const step = nextRandomUnit(state);
  return { state: step.state, value: Math.floor(step.value * exclusiveMaximum) };
}
