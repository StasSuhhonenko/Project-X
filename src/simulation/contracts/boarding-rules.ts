/** Optional, immediate ship boarding. Geometry and all outcome draws belong to
 * module policy; the engine owns validated rewards, identity and settlement. */
import { z } from 'zod';
import { ShipDefinitionSchema } from '../../content/schemas/game-content';
import { UInt32Schema } from '../../random/seeded-random';
import {
  NoticeMessageSchema,
  PositionSchema,
  PositiveDefinitionIdSchema,
  RotationDegreesSchema,
} from '../model/entity-components';
import { ProgressionStateSchema } from '../model/progression-state';

/** Positions/strength are world units and combined hull + shields respectively;
 * headings are clockwise degrees from up. Assessment consumes no random draws. */
export const BoardingAssessmentContextSchema = z
  .object({
    playerPosition: PositionSchema,
    playerHeadingDegrees: RotationDegreesSchema,
    playerDefinitionId: PositiveDefinitionIdSchema,
    targetPosition: PositionSchema,
    targetHeadingDegrees: RotationDegreesSchema,
    targetDefinitionId: PositiveDefinitionIdSchema,
    targetStrength: z.number().finite().nonnegative(),
    targetMaximumStrength: z.number().finite().nonnegative(),
    cameraZoom: z.number().finite().positive(),
    targetKind: z.literal('npc-ship'),
  })
  .strict()
  .readonly();
/** Beam range controls only the preliminary notice, independently of eligibility. */
export const BoardingAssessmentSchema = z
  .object({ inBeamRange: z.boolean(), eligible: z.boolean() })
  .strict()
  .readonly();
/** Existing government/standing owners supply nullable local facts. Pirate or
 * other special allegiances are module constants, never a parallel engine owner.
 * randomState is exclusively the boarded actor's stream, in policy draw order;
 * progression, if declared, uses its own stream after successful resolution. */
export const BoardingContextSchema = z
  .object({
    playerVessel: ShipDefinitionSchema,
    targetVessel: ShipDefinitionSchema,
    targetGovernmentId: PositiveDefinitionIdSchema,
    localGovernmentId: PositiveDefinitionIdSchema.nullable(),
    opposingGovernmentId: PositiveDefinitionIdSchema.nullable(),
    standing: z.number().finite().nullable(),
    progression: ProgressionStateSchema.nullable(),
    ownedWeaponIds: z.array(PositiveDefinitionIdSchema.nullable()).readonly(),
    randomState: UInt32Schema,
    alreadyOwned: z.boolean(),
  })
  .strict()
  .readonly();
/** Resource amounts use declared balance units. Null salvage grants no weapon.
 * Self destruction is mandatory except for capture, including already-owned
 * capture (which acknowledges success without adding another roster record). */
export const BoardingResultSchema = z
  .object({
    randomState: UInt32Schema,
    standingDelta: z.number().finite(),
    message: NoticeMessageSchema,
    outcome: z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('pillage'),
          resourceId: z.string().min(1),
          amount: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
        })
        .strict()
        .readonly(),
      z
        .object({ kind: z.literal('salvage'), weaponDefinitionId: PositiveDefinitionIdSchema.nullable() })
        .strict()
        .readonly(),
      z
        .object({ kind: z.literal('capture') })
        .strict()
        .readonly(),
      z
        .object({ kind: z.literal('failed-capture') })
        .strict()
        .readonly(),
    ]),
    selfDestruct: z.boolean(),
  })
  .strict()
  .superRefine((result, context) => {
    if (result.selfDestruct !== (result.outcome.kind !== 'capture'))
      context.addIssue({ code: 'custom', message: 'Only capture may retain the boarded actor.' });
  })
  .readonly();
/** Validated geometry input, inferred from its authoritative schema. */
export type BoardingAssessmentContext = z.infer<typeof BoardingAssessmentContextSchema>;
/** Independent beam notice and eligibility decisions. */
export type BoardingAssessment = z.infer<typeof BoardingAssessmentSchema>;
/** Frozen policy facts; actor stream ownership is documented above. */
export type BoardingContext = z.infer<typeof BoardingContextSchema>;
/** Validated outcome and continuation of the boarded actor's stream. */
export type BoardingResult = z.infer<typeof BoardingResultSchema>;
/** Declaring boarding creates no saved state or tick work. A capture result
 * additionally requires the optional fleet capability at the result boundary. */
export interface BoardingRules {
  /** Module text used only when assessment reports beam range. */
  readonly beamOverMessage: string;
  /** Pure geometry/eligibility query, without random draws. */
  assessBoarding(context: BoardingAssessmentContext): BoardingAssessment;
  /** Called once per eligible intent; owns all boarding outcome draw order. */
  resolveBoarding(context: BoardingContext): BoardingResult;
}
