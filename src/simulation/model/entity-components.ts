/** Authoritative schemas for reusable runtime entity components. */
import { z } from 'zod';

/** Authored station placement key, distinct from a runtime entity identity. */
export const StationPlacementIdSchema = z.string().regex(/^[a-z][a-z0-9-]*$/);

export const PositiveDefinitionIdSchema = z.number().int().positive();
export const SystemIdSchema = z.number().int().positive();
/** Calendar parts are module-defined display units; minor counts from one. */
export const CalendarDateSchema = z.object({
  major: z.number().int().nonnegative(),
  minor: z.number().int().positive(),
}).strict().readonly();
export type CalendarDate = z.infer<typeof CalendarDateSchema>;
export const RuntimeEntityIdSchema = z.string().regex(/^entity-[1-9][0-9]*$/);
export const FiniteNumberSchema = z.number().finite();
export const NonNegativeNumberSchema = FiniteNumberSchema.nonnegative();

export const PositionSchema = z.object({
  x: FiniteNumberSchema,
  y: FiniteNumberSchema,
}).strict().readonly();
export type Position = z.infer<typeof PositionSchema>;

export const RotationDegreesSchema = FiniteNumberSchema;
export const FlightModeSchema = z.enum(['impulse', 'warp']);
export type FlightMode = z.infer<typeof FlightModeSchema>;
export const PlayerSpeedPerFrameSchema = FiniteNumberSchema.max(0);
export const RepairingSchema = z.boolean();
export const ResourceBalancesSchema = z.record(
  z.string().regex(/^[a-z][a-z0-9-]*$/),
  NonNegativeNumberSchema,
).readonly();
export const CargoBalancesSchema = z.record(
  z.string().regex(/^[a-z][a-z0-9-]*$/),
  z.number().int().nonnegative(),
).readonly();

export const LocationComponentSchema = z.object({
  systemId: SystemIdSchema,
  position: PositionSchema,
  rotationDegrees: RotationDegreesSchema,
}).strict().readonly();
export type LocationComponent = z.infer<typeof LocationComponentSchema>;

export const PlayerMotionComponentSchema = z.object({
  speedPerFrame: PlayerSpeedPerFrameSchema,
  flightMode: FlightModeSchema,
}).strict().readonly();
export type PlayerMotionComponent = z.infer<typeof PlayerMotionComponentSchema>;

export const NpcMotionComponentSchema = z.object({
  speedPerFrame: NonNegativeNumberSchema,
  desiredSpeedPerFrame: NonNegativeNumberSchema,
}).strict().readonly();
export type NpcMotionComponent = z.infer<typeof NpcMotionComponentSchema>;

/** Engine-owned reference plus a module-owned offset in world-coordinate units. */
export const NpcNavigationIntentSchema = z.object({
  /** Null after the referenced entity is destroyed, until an AI rule reacquires. */
  targetEntityId: RuntimeEntityIdSchema.nullable(),
  targetOffset: PositionSchema,
}).strict().readonly();
export type NpcNavigationIntent = z.infer<typeof NpcNavigationIntentSchema>;

/** Last module-authored player notice; sequence distinguishes repeated events. */
export const PlayerNoticeSchema = z.object({
  sequence: z.number().int().positive(),
  code: z.string().regex(/^[a-z][a-z0-9-]*$/),
  message: z.string().min(1).max(160),
}).strict().readonly();
export type PlayerNotice = z.infer<typeof PlayerNoticeSchema>;

/** Damage-bearing values shared by player and NPC ships. */
const DurabilityComponentFields = {
  hull: NonNegativeNumberSchema,
  shields: NonNegativeNumberSchema,
};
export const DurabilityComponentSchema = z.object(DurabilityComponentFields).strict().readonly();
export type DurabilityComponent = z.infer<typeof DurabilityComponentSchema>;

export const PlayerConditionComponentSchema = z.object({
  ...DurabilityComponentFields,
  energy: NonNegativeNumberSchema,
  repairing: RepairingSchema,
}).strict().readonly();
export type PlayerConditionComponent = z.infer<typeof PlayerConditionComponentSchema>;

export const InventoryComponentSchema = z.object({
  resources: ResourceBalancesSchema,
  /** Ordinary cargo quantities are tons; resource balances are separate. */
  cargo: CargoBalancesSchema,
}).strict().readonly();
export type InventoryComponent = z.infer<typeof InventoryComponentSchema>;

export const PlayerFeedbackComponentSchema = z.object({
  notice: PlayerNoticeSchema.nullable(),
}).strict().readonly();
export type PlayerFeedbackComponent = z.infer<typeof PlayerFeedbackComponentSchema>;
