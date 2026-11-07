/** Staged C8 table: Page3 document missions literal, offset1346 (recovery
 * table0..35). Preserve spelling/whitespace; only1..31 can be generated. */
import { z } from 'zod';
import raw from './mission-data.json';

const dimension = z.number().finite().positive();
export const MissionDataSchema = z
  .object({
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    stationListings: z
      .array(
        z
          .object({ stationId: z.string().min(1), slots: z.array(z.number().int().min(0).max(5)).readonly() })
          .strict()
          .readonly()
      )
      .readonly(),
    missions: z
      .array(
        z
          .object({ index: z.number().int().nonnegative(), text: z.string(), standingDelta: z.number().int() })
          .strict()
          .readonly()
      )
      .length(36)
      .readonly(),
    destinations: z
      .array(
        z
          .object({
            sourceIndex: z.number().int().positive(),
            sourceName: z.string(),
            systemId: z.number().int().positive().nullable(),
          })
          .strict()
          .readonly()
      )
      .length(50)
      .readonly(),
    entities: z
      .array(z.object({ id: z.number().int().positive(), width: dimension, height: dimension }).strict().readonly())
      .readonly(),
    planets: z
      .array(
        z
          .object({
            id: z.number().int().positive(),
            width: dimension,
            height: dimension,
            pivotX: z.number().min(0).max(1),
            pivotY: z.number().min(0).max(1),
          })
          .strict()
          .readonly()
      )
      .readonly(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.missions.some((row, index) => row.index !== index) ||
      data.destinations.some((row, index) => row.sourceIndex !== index + 1)
    )
      ctx.addIssue({ code: 'custom', message: 'C8 source indices must remain ordered and complete.' });
  })
  .readonly();
export const missionData = MissionDataSchema.parse(raw);
