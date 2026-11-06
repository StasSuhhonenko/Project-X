/** Authoritative local geometry in world units. No texture, image dimensions,
 * model, camera or graphics-library type participates in this contract. */
import { z } from 'zod';

const finite = z.number().finite();
const id = z.number().int().positive();
const point = z.object({ x: finite, y: finite }).strict().readonly();
const size = z.object({ width: finite.positive(), height: finite.positive() }).strict().readonly();
export const AffineTransformSchema = z.tuple([finite, finite, finite, finite, finite, finite]).readonly();
export const LocalBoundsSchema = z.object({ left: finite, top: finite, right: finite, bottom: finite })
  .strict().refine(box => box.right > box.left && box.bottom > box.top, 'Bounds require positive area.').readonly();
export const EffectLayerGeometrySchema = z.object({
  id: z.string().min(1), bounds: LocalBoundsSchema, transform: AffineTransformSchema,
  rotationDegreesPerTick: finite.min(-360).max(360).optional(),
  rotationPivot: point.optional(),
}).strict().readonly();
const layers = z.array(EffectLayerGeometrySchema).max(16).readonly();
export const SpecialEffectGeometrySchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/), kind: z.enum(['pulse', 'tractor']), layers,
  innerTransform: AffineTransformSchema.optional(),
  innerAnimation: z.object({
    initialScalePercent: finite.nonnegative().max(10000), growthPerTick: finite.nonnegative().max(1000),
    initialAlphaPercent: finite.min(0).max(100), fadePerTick: finite.nonnegative().max(100),
    minimumAlphaPercent: finite.min(0).max(100), alphaQuantumPercent: finite.min(0).max(100),
    stepEveryTicks: z.number().int().positive().max(240).default(1),
    firstStepAgeTick: z.number().int().nonnegative().max(239).default(1),
    removeBelowAlphaAffectsBounds: z.boolean().default(true),
  }).strict().readonly().optional(),
  frameCycleTicks: z.number().int().positive().max(240).optional(),
  poses: z.array(z.object({ firstAgeTick: z.number().int().nonnegative().max(239), layers })
    .strict().readonly()).min(1).max(120).readonly().optional(),
}).strict().superRefine((effect, context) => {
  const poses = effect.poses, cycle = effect.frameCycleTicks;
  if ((poses === undefined) !== (cycle === undefined)
    || (poses && cycle !== undefined && (poses[0]?.firstAgeTick !== 0 || poses.some((pose, index) =>
      pose.firstAgeTick >= cycle || (index > 0 && pose.firstAgeTick <= poses[index - 1]!.firstAgeTick)))))
    context.addIssue({ code: 'custom', message: 'Effect poses require an ordered cycle beginning at zero.' });
  if (effect.kind === 'pulse' && effect.layers.length === 0)
    context.addIssue({ code: 'custom', message: 'Pulse geometry requires local layers.' });
  const ids = [...effect.layers, ...(poses?.flatMap(pose => pose.layers) ?? [])].map(layer => layer.id);
  if (new Set(ids).size !== ids.length)
    context.addIssue({ code: 'custom', message: 'Geometry layer IDs must be unique.' });
}).readonly();
export type SpecialEffectGeometry = z.infer<typeof SpecialEffectGeometrySchema>;
export type EffectLayerGeometry = z.infer<typeof EffectLayerGeometrySchema>;

export const CombatGeometrySchema = z.object({
  entities: z.array(z.object({ entityDefinitionId: id, size, playerSize: size.optional(), pivot: point })
    .strict().readonly()).readonly(),
  projectiles: z.array(z.object({ weaponDefinitionId: id, size, pivot: point }).strict().readonly()).readonly(),
  specialEffects: z.array(SpecialEffectGeometrySchema).readonly(),
}).strict().superRefine((geometry, context) => {
  const keys = [geometry.entities.map(item => item.entityDefinitionId),
    geometry.projectiles.map(item => item.weaponDefinitionId), geometry.specialEffects.map(item => item.id)];
  if (keys.some(values => new Set<string | number>(values).size !== values.length))
    context.addIssue({ code: 'custom', message: 'Combat geometry IDs must be unique.' });
}).readonly();
export type CombatGeometry = z.infer<typeof CombatGeometrySchema>;

export function entityCombatGeometry(geometry: CombatGeometry, definitionId: number, player = false) {
  const entity = geometry.entities.find(item => item.entityDefinitionId === definitionId);
  if (!entity) throw new Error('Entity combat geometry is unavailable.');
  return { size: player ? entity.playerSize ?? entity.size : entity.size, pivot: entity.pivot };
}
