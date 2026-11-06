import { CloakAppearanceSchema } from '../shared/actor-opacity';
/** Pixi-only publication schema. Gameplay parsing never reads this document. */
import { z } from 'zod';
import { StarFieldDefinitionSchema } from '../../content/schemas/star-field';
import type { GameModuleDefinition } from '../../content/schemas/game-module';
const Id = z.string().regex(/^[a-z][a-z0-9-]*$/);
const PositiveId = z.number().int().positive();
const FiniteNumber = z.number().finite();
/** Breaking JSON-contract changes require a new selected module schema. */

// Restrict assets to local module paths: no schemes, traversal, queries, or
// percent-encoded separators. Build tooling supplies the selected public root.
const AssetPath = z.string().regex(/^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:gif|png|jpg|webp|svg)$/);
const AudioAssetPath = z.string().regex(/^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:wav|mp3|ogg)$/);
const NativeSizeSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
}).strict().readonly();
const PivotSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  status: z.enum(['verified', 'provisional']),
}).strict().readonly();
const EntityVisualSchema = z.object({
  entityDefinitionId: PositiveId,
  image: AssetPath,
  nativeSize: NativeSizeSchema,
  /** Uniform bitmap-to-world multiplier; omitted means native pixel size. */
  scale: z.number().finite().positive().optional(),
  /** Additional per-axis bitmap multiplier. Omission preserves uniform scale;
   * dimensions and pivots still describe the same unmodified source bitmap. */
  axisScale: z.object({
    x: z.number().finite().positive(),
    y: z.number().finite().positive(),
  }).strict().readonly().optional(),
  /** Additional uniform multiplier only while this ship is the player.
   * NPCs retain the base scale; omission means one. This changes artwork only. */
  playerScale: z.number().finite().positive().optional(),
  pivot: PivotSchema,
}).strict().superRefine((visual, context) => {
  // Finite inputs can still overflow when multiplied. Reject that content
  // before sprites, pointer bounds or spatial read models receive invalid sizes.
  const worldLengths = [
    visual.nativeSize.width * (visual.axisScale?.x ?? 1),
    visual.nativeSize.height * (visual.axisScale?.y ?? 1),
  ].map(length => length * (visual.scale ?? 1));
  if (!worldLengths.every(length => Number.isFinite(length) && length > 0)) {
    context.addIssue({ code: 'custom', path: ['scale'], message: 'Scaled entity dimensions must remain finite.' });
  }
  if (!worldLengths.every(length => {
    const playerLength = length * (visual.playerScale ?? 1);
    return Number.isFinite(playerLength) && playerLength > 0;
  })) {
    context.addIssue({ code: 'custom', path: ['playerScale'], message: 'Player dimensions must remain finite and positive.' });
  }
}).readonly();
const PlanetVisualSchema = z.object({
  visualTypeId: PositiveId,
  image: AssetPath,
  nativeSize: NativeSizeSchema,
  pivot: PivotSchema,
}).strict().readonly();
const BeamBitmapLayerSchema = z.object({
  image: AssetPath,
  nativeSize: NativeSizeSchema,
  /** Authored bitmap-to-beam transform; linear terms are unitless and the
   * final pair is logical pixels before the parent's distance/zoom scaling. */
  bitmapTransform: z.tuple([FiniteNumber, FiniteNumber, FiniteNumber, FiniteNumber, FiniteNumber, FiniteNumber]).readonly(),
}).strict().readonly();
/** A bitmap layer can spin about its original registration rather than its
 * padded image origin. Bounds retain fractional source crop/stroke dimensions
 * when an SVG's integer canvas has transparent padding. */
const SpecialEffectVisualSchema = z.object({
  id: Id, kind: z.enum(['pulse', 'tractor']),
  targetScatterWorldUnits: FiniteNumber.nonnegative().max(1000).optional(),
  layers: z.array(z.object({ id: z.string().min(1), image: AssetPath, nativeSize: NativeSizeSchema,
    alphaMultiplier: FiniteNumber.min(0).max(1).optional() }).strict().readonly()).min(1).readonly(),
}).strict().readonly();
export type SpecialEffectVisual = z.infer<typeof SpecialEffectVisualSchema>;
const WeaponBeamVisualSchema = z.object({
  weaponDefinitionId: PositiveId,
  image: AssetPath,
  nativeSize: NativeSizeSchema,
  /** Logical symbol bounds before its X axis is stretched to target distance. */
  logicalSize: z.object({
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
  }).strict().readonly(),
  pivot: PivotSchema,
  /** Number of committed simulation frames for which the effect remains visible. */
  durationFrames: z.number().int().positive().max(240),
  /** Legacy target jitter radius in unzoomed world/display units. */
  impactScatterWorldUnits: z.number().finite().nonnegative().max(1000),
  /** Optional authored bitmap keyposes, indexed by committed visual age.
   * Omission preserves the original single-image presentation contract. */
  frameCycleTicks: z.number().int().positive().max(240).optional(),
  frames: z.array(z.object({
    firstAgeTick: z.number().int().nonnegative().max(239),
    layers: z.array(BeamBitmapLayerSchema).min(1).max(16).readonly(),
  }).strict().readonly()).min(1).max(120).readonly().optional(),
}).strict().superRefine((visual, context) => {
  if ((visual.frames === undefined) !== (visual.frameCycleTicks === undefined)) {
    context.addIssue({ code: 'custom', message: 'Beam keyposes require both frames and a cycle.' });
    return;
  }
  const frames = visual.frames;
  const cycle = visual.frameCycleTicks;
  if (!frames || cycle === undefined) return;
  if (frames[0]?.firstAgeTick !== 0 || frames.some((frame, index) =>
    frame.firstAgeTick >= cycle || (index > 0 && frame.firstAgeTick <= frames[index - 1]!.firstAgeTick))) {
    context.addIssue({ code: 'custom', message: 'Beam keyposes must start at zero and increase within their cycle.' });
  }
}).readonly();

/** Bitmap registration may lie outside a projectile image. Preserve authored
 * fractions rather than silently recentering narrow streaks. */
const ProjectileImageSchema = z.object({
  image: AssetPath,
  nativeSize: NativeSizeSchema,
  logicalSize: z.object({ width: FiniteNumber.positive(), height: FiniteNumber.positive() }).strict().readonly(),
  pivot: z.object({ x: FiniteNumber, y: FiniteNumber }).strict().readonly(),
}).strict().readonly();
const WeaponProjectileVisualSchema = ProjectileImageSchema.unwrap().extend({
  weaponDefinitionId: PositiveId,
  impactFrames: z.array(ProjectileImageSchema.unwrap().extend({
    firstImpactAgeTicks: z.number().int().nonnegative().max(240),
  }).strict().readonly()).readonly(),
}).strict().superRefine((visual,context) => {
  if (visual.impactFrames.some((frame,index) => index>0 && frame.firstImpactAgeTicks<=visual.impactFrames[index-1]!.firstImpactAgeTicks))
    context.addIssue({code:'custom',message:'Projectile impact frames must increase strictly.'});
}).readonly();


export const PixiVisualsSchema = z.object({
    entities: z.array(EntityVisualSchema).min(1).readonly(),
    planets: z.array(PlanetVisualSchema).min(1).readonly(),
    /** Optional additive v5 field; omitted modules have no beam presentation. */
    weaponBeams: z.array(WeaponBeamVisualSchema).readonly().optional().default([]),
    weaponProjectiles: z.array(WeaponProjectileVisualSchema).readonly().optional().default([]),
    specialEffects: z.array(SpecialEffectVisualSchema).readonly().optional().default([]),
    /** View-only cloak fade; authoritative visibility state belongs to actors. */
    cloak: CloakAppearanceSchema.optional(),
  }).strict().readonly();
export const PixiSpatialConfigurationSchema = z.object({
  schemaVersion: z.literal(1), moduleId: Id, moduleVersion: z.string().min(1),
  viewport: z.object({ width: PositiveId, height: PositiveId,
    cameraAnchor: z.object({ x: FiniteNumber, y: FiniteNumber }).strict().readonly().optional(),
    zoom: z.object({ pivot: z.object({ x: FiniteNumber, y: FiniteNumber }).strict().readonly().optional() }).strict().readonly().optional(),
  }).strict().readonly(),
  visuals: PixiVisualsSchema, starField: StarFieldDefinitionSchema.optional(),
}).strict().superRefine((config, context) => {
  const pivot = config.viewport.zoom?.pivot;
  if (pivot && (pivot.x < 0 || pivot.x > config.viewport.width || pivot.y < 0 || pivot.y > config.viewport.height))
    context.addIssue({ code: 'custom', path: ['viewport', 'zoom', 'pivot'], message: 'Zoom pivot must be inside the logical viewport.' });
}).readonly();
export type PixiSpatialConfiguration = z.infer<typeof PixiSpatialConfigurationSchema>;
export type PixiSceneDefinition = GameModuleDefinition & Pick<PixiSpatialConfiguration, 'visuals' | 'starField' | 'viewport'>;

export async function loadPixiSceneDefinition(game: GameModuleDefinition, fetcher: typeof fetch = fetch) {
  const response = await fetcher('/game/spatial.json');
  if (!response.ok) throw new Error(`Could not load spatial configuration: HTTP ${response.status}.`);
  return createPixiSceneDefinition(game, await response.json());
}

/** Validates identity/references before publishing a client or allocating a GPU. */
export function createPixiSceneDefinition(game: GameModuleDefinition, input: unknown): PixiSceneDefinition {
  const config = PixiSpatialConfigurationSchema.parse(input);
  if (config.moduleId !== game.id || config.moduleVersion !== game.version
    || config.viewport.width !== game.viewport.width || config.viewport.height !== game.viewport.height)
    throw new Error('Spatial configuration differs from the selected gameplay module.');
  const visuals = config.visuals;
  const unique = (values: readonly (number | string)[]) => new Set(values).size === values.length;
  if (!unique(visuals.entities.map(item => item.entityDefinitionId)) || !unique(visuals.planets.map(item => item.visualTypeId))
    || !unique(visuals.weaponBeams.map(item => item.weaponDefinitionId)) || !unique(visuals.weaponProjectiles.map(item => item.weaponDefinitionId))
    || !unique(visuals.specialEffects.map(item => item.id))) throw new Error('Spatial mapping IDs must be unique.');
  visuals.entities.forEach(item => {
    const entity = game.content.entityDefinitions.find(entity => entity.id === item.entityDefinitionId);
    if (!entity || (item.playerScale !== undefined && entity.category !== 'ship')) throw new Error('Spatial entity reference is invalid.');
  });
  [...visuals.weaponBeams, ...visuals.weaponProjectiles].forEach(item => {
    if (!game.content.weaponDefinitions.some(weapon => weapon.id === item.weaponDefinitionId)) throw new Error('Spatial weapon reference is invalid.');
  });
  if (visuals.weaponProjectiles.some(item => visuals.weaponBeams.some(beam => beam.weaponDefinitionId === item.weaponDefinitionId)))
    throw new Error('A weapon cannot have both beam and projectile presentation.');
  const requiredActors = new Set([...game.starts.map(start => start.player.entityDefinitionId),
    ...game.starts.flatMap(start => start.npcSpawn ? [start.npcSpawn.shipDefinitionId] : []),
    ...(game.lifecycle?.spawnShipDefinitionIds ?? []),
    ...game.systems.flatMap(system => [...system.stations.map(station => station.structureDefinitionId),
      ...system.planet.offeredEntityDefinitionIds.filter((id): id is number => id !== null
        && game.content.entityDefinitions.some(entity => entity.id === id && entity.category === 'ship')
        && game.combatGeometry.entities.some(geometry => geometry.entityDefinitionId === id))])]);
  if ([...requiredActors].some(id => !visuals.entities.some(item => item.entityDefinitionId === id)))
    throw new Error('Reachable entity lacks spatial artwork.');
  if (game.systems.some(system => !visuals.planets.some(item => item.visualTypeId === system.planet.visualTypeId)))
    throw new Error('Reachable planet lacks spatial artwork.');
  game.combatGeometry.projectiles.forEach(item => {
    if (!visuals.weaponProjectiles.some(visual => visual.weaponDefinitionId === item.weaponDefinitionId)) throw new Error('Projectile artwork is unavailable.');
  });
  game.combatGeometry.specialEffects.forEach(effect => {
    const art = visuals.specialEffects.find(item => item.id === effect.id && item.kind === effect.kind);
    if (!art || [...effect.layers, ...(effect.poses?.flatMap(pose => pose.layers) ?? [])].some(layer => !art.layers.some(item => item.id === layer.id)))
      throw new Error('Special effect artwork coverage is incomplete.');
  });
  return Object.freeze({ ...game, ...config, id: game.id, version: game.version, schemaVersion: game.schemaVersion });
}
