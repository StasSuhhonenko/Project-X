/** Visit population intent: modules own draws/content, the engine owns actors. */
import { z } from 'zod';
import type { GameModuleDefinition, SystemDefinition } from '../../content/schemas/game-module';
import { UInt32Schema } from '../../random/seeded-random';
import { PositionSchema, RotationDegreesSchema } from '../model/entity-components';

/** Display identity, never a multiline notice or an executable metadata bag. */
export const EncounterNameSchema = z
  .string()
  .min(1)
  .max(256)
  .refine(
    name => name.trim().length > 0 && !/[\r\n\u2028\u2029]/.test(name),
    'Encounter names must be nonblank single-line text.'
  );
export const EncounterShipSpecSchema = z
  .object({
    definitionId: z.number().int().positive(),
    governmentId: z.number().int().positive(),
    name: EncounterNameSchema,
    /** Optional module race identity; no shared race mechanics are implied. */
    raceId: z.number().int().positive().optional(),
    /** World-space units, absolute within the active system. */
    position: PositionSchema,
    rotationDegrees: RotationDegreesSchema.optional(),
    /** The planet, or an index into the actor slots captured at entry
     * (`VisitEncounterContext.actorSlotCount`). An empty slot (slot 0 or a hole
     * left by a destroyed actor) gives the ship no target; it is never rerolled. */
    initialTarget: z.discriminatedUnion('kind', [
      z
        .object({ kind: z.literal('planet') })
        .strict()
        .readonly(),
      z
        .object({ kind: z.literal('actor-slot'), slot: z.number().int().nonnegative() })
        .strict()
        .readonly(),
    ]),
  })
  .strict()
  .readonly();
export type EncounterShipSpec = z.infer<typeof EncounterShipSpecSchema>;
export const VisitEncounterResultSchema = z
  .object({
    ships: z.array(EncounterShipSpecSchema).readonly(),
    randomState: UInt32Schema,
  })
  .strict()
  .readonly();
export type VisitEncounterResult = z.infer<typeof VisitEncounterResultSchema>;

/** Deeply frozen content plus facts captured at entry. Population is the
 * module-declared initial value in billions; no mutable population exists.
 * Returned randomState is the continuation of the supplied world stream. */
export interface VisitEncounterContext {
  readonly system: SystemDefinition;
  readonly systems: GameModuleDefinition['systems'];
  readonly governments: GameModuleDefinition['governments'];
  readonly randomState: number;
  readonly population: number;
  /** Number of actor slots before this encounter, including empty slots: the
   * bound for `actor-slot` targets. */
  readonly actorSlotCount: number;
  /** Arrival position and zoom, for modules that place ships relative to the view. */
  readonly playerPosition: Readonly<{ x: number; y: number }>;
  readonly cameraZoom: number;
}
