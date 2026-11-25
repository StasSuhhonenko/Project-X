/** Durable captain-owned construction records. Deployments are visit-local;
 * identity never depends on station names and destroyed records are retained. */
import { z } from 'zod';
import { PositionSchema, RuntimeEntityIdSchema } from './entity-components';

export const ConstructedStationIdSchema = z.string().regex(/^constructed-[1-9][0-9]*$/);
export const ConstructedStationSchema = z
  .object({
    id: ConstructedStationIdSchema,
    structureDefinitionId: z.number().int().positive(),
    systemId: z.number().int().positive(),
    name: z.string().trim().min(1),
    positionOffset: PositionSchema,
    rotationDegrees: z.number().finite(),
    destinationSystemId: z.number().int().positive().nullable(),
    phase: z.discriminatedUnion('kind', [
      z
        .object({ kind: z.literal('pending'), progress: z.number().finite().negative() })
        .strict()
        .readonly(),
      z
        .object({ kind: z.literal('complete') })
        .strict()
        .readonly(),
      z
        .object({ kind: z.literal('destroyed') })
        .strict()
        .readonly(),
    ]),
  })
  .strict()
  .readonly();
export const ConstructionStateSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    nextStationSequence: z.number().int().positive(),
    plans: z.array(z.number().int().positive().nullable()).readonly(),
    stations: z.array(ConstructedStationSchema).readonly(),
    deployments: z
      .array(z.object({ stationId: ConstructedStationIdSchema, entityId: RuntimeEntityIdSchema }).strict().readonly())
      .readonly(),
  })
  .strict()
  .readonly()
  .superRefine((state, context) => {
    const ids = state.stations.map(station => station.id);
    if (
      new Set(ids).size !== ids.length ||
      state.nextStationSequence !== state.stations.length + 1 ||
      state.stations.some((station, index) => station.id !== 'constructed-' + (index + 1))
    )
      context.addIssue({
        code: 'custom',
        message: 'Construction identities must be unique and predate their allocator.',
      });
    if (
      new Set(state.deployments.map(link => link.stationId)).size !== state.deployments.length ||
      new Set(state.deployments.map(link => link.entityId)).size !== state.deployments.length ||
      state.deployments.some(link => !state.stations.some(station => station.id === link.stationId))
    )
      context.addIssue({
        code: 'custom',
        message: 'Construction deployments must uniquely reference retained records.',
      });
  });
export type ConstructedStation = z.infer<typeof ConstructedStationSchema>;
export type ConstructionState = z.infer<typeof ConstructionStateSchema>;

/** Single durable destruction projection, shared by both death entry paths.
 * Stable IDs prevent same-name stations from sharing death membership. */
export function constructionAfterDeaths(state: ConstructionState, entityIds: ReadonlySet<string>): ConstructionState {
  const removed = new Set(state.deployments.filter(link => entityIds.has(link.entityId)).map(link => link.stationId));
  if (!removed.size) return state;
  return ConstructionStateSchema.parse({
    ...state,
    revision: state.revision + 1,
    stations: state.stations.map(station =>
      removed.has(station.id) ? { ...station, phase: { kind: 'destroyed' } } : station
    ),
    deployments: state.deployments,
  });
}
