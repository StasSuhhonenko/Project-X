/** Focused, validated NPC rule inputs and outputs without runtime identity. */
import { z } from 'zod';
import { UInt32Schema } from '../../random/seeded-random';
import {
  NpcMotionComponentSchema,
  PositionSchema,
  RotationDegreesSchema,
  RuntimeEntityIdSchema,
} from './entity-components';

export const NpcTargetKindSchema = z.enum(['player-ship', 'planet', 'station', 'npc-ship']);

export const NpcTargetStateSchema = z.object({
  id: RuntimeEntityIdSchema,
  kind: NpcTargetKindSchema,
  position: PositionSchema,
}).strict().readonly();
export type NpcTargetState = z.infer<typeof NpcTargetStateSchema>;

/** One module-selected initial placement; the engine supplies entity identity. */
export const StartingNpcPlacementSchema = z.object({
  position: PositionSchema,
  targetEntityId: RuntimeEntityIdSchema,
  targetOffset: PositionSchema,
  randomState: UInt32Schema,
}).strict().readonly();
export type StartingNpcPlacement = z.infer<typeof StartingNpcPlacementSchema>;

/** Fields an NPC movement rule may update during one fixed simulation tick. */
export const NpcMovementStateSchema = z.object({
  position: PositionSchema,
  rotationDegrees: RotationDegreesSchema,
  motion: NpcMotionComponentSchema,
  targetOffset: PositionSchema,
}).strict().readonly();
export type NpcMovementState = z.infer<typeof NpcMovementStateSchema>;

export const NpcTickResultSchema = z.object({
  movement: NpcMovementStateSchema,
  randomState: UInt32Schema,
}).strict().readonly();
export type NpcTickResult = z.infer<typeof NpcTickResultSchema>;

export function freezeNpcTargetState(target: NpcTargetState): NpcTargetState {
  Object.freeze(target.position);
  return Object.freeze(target);
}

export function freezeNpcMovementState(state: NpcMovementState): NpcMovementState {
  Object.freeze(state.position);
  Object.freeze(state.motion);
  Object.freeze(state.targetOffset);
  return Object.freeze(state);
}
