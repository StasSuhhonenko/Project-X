/** Per-channel reload and accepted/resolved command history, in simulation ticks. */
import { z } from 'zod';
import { RuntimeEntityIdSchema } from './entity-components';

const AcceptedShotSchema = z
  .object({
    sequence: z.number().int().positive(),
    weaponDefinitionId: z.number().int().positive(),
    targetEntityId: RuntimeEntityIdSchema.nullable(),
    tick: z.number().int().positive(),
  })
  .strict()
  .readonly();
export const PrimaryWeaponStateSchema = z
  .object({
    weaponDefinitionId: z.number().int().positive().nullable(),
    cooldownRemainingFrames: z.number().finite().nonnegative(),
    shotSequence: z.number().int().nonnegative(),
    resolvedShotSequence: z.number().int().nonnegative(),
    lastAcceptedShot: AcceptedShotSchema.nullable(),
  })
  .strict()
  .readonly();
export type PrimaryWeaponState = z.infer<typeof PrimaryWeaponStateSchema>;
/** Re-equipping discards the old channel's history; emitted effects own theirs. */
export function createArmament(weaponDefinitionId: number | null, cooldownRemainingFrames = 0): PrimaryWeaponState {
  return PrimaryWeaponStateSchema.parse({
    weaponDefinitionId,
    cooldownRemainingFrames,
    shotSequence: 0,
    resolvedShotSequence: 0,
    lastAcceptedShot: null,
  });
}
