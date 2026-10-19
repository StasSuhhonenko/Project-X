/** Frozen display-only HUD data; no world, store or simulation mutation access. */
import { z } from 'zod';
import { PlayerConditionComponentSchema, PlayerMotionComponentSchema, ResourceBalancesSchema,
  PositiveDefinitionIdSchema, SystemIdSchema, PlayerNoticeSchema } from '../simulation/model/entity-components';
import { PrimaryWeaponStateSchema } from '../simulation/model/world-state';

/** Values consumed by existing HUDs; units follow the authoritative components. */
export const GameHudViewSchema = z.object({
  playerDefinitionId: PositiveDefinitionIdSchema,
  systemId: SystemIdSchema,
  hull: PlayerConditionComponentSchema.unwrap().shape.hull,
  shields: PlayerConditionComponentSchema.unwrap().shape.shields,
  energy: PlayerConditionComponentSchema.unwrap().shape.energy,
  weaponDefinitionId: PrimaryWeaponStateSchema.unwrap().shape.weaponDefinitionId,
  cooldownRemainingFrames: PrimaryWeaponStateSchema.unwrap().shape.cooldownRemainingFrames,
  shotSequence: PrimaryWeaponStateSchema.unwrap().shape.shotSequence,
  resources: ResourceBalancesSchema,
  /** Ordinary cargo totals are tons, separate from resource balances. */
  cargoUsed: z.number().int().nonnegative(),
  speedPerFrame: PlayerMotionComponentSchema.unwrap().shape.speedPerFrame,
  flightMode: PlayerMotionComponentSchema.unwrap().shape.flightMode,
  positionX: z.number().finite(),
  positionY: z.number().finite(),
  zoom: z.number().finite().positive(),
  noticeMessage: PlayerNoticeSchema.unwrap().shape.message.nullable(),
  /** Equal repeated text still changes sequence for semantic announcements. */
  noticeSequence: PlayerNoticeSchema.unwrap().shape.sequence.nullable(),
  repairing: PlayerConditionComponentSchema.unwrap().shape.repairing,
}).strict().readonly();

export type GameHudView = z.infer<typeof GameHudViewSchema>;
