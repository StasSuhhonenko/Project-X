/**
 * Game-neutral entity contracts shared by module data and simulation rules.
 *
 * Zod schemas are the single source of truth. Types are inferred from them,
 * preventing the JSON validator and TypeScript model from drifting apart.
 */
import { z } from 'zod';

const PositiveIdSchema = z.number().int().positive();
const NonNegativeNumberSchema = z.number().finite().nonnegative();
const StartingWeaponIdsSchema = z.tuple([
  PositiveIdSchema.nullable(),
  PositiveIdSchema.nullable(),
  PositiveIdSchema.nullable(),
]).readonly();

const EntityIdentitySchema = z.object({
  id: PositiveIdSchema,
  name: z.string().min(1),
  description: z.string(),
});

/** Mobile vessel capabilities. Speed and turn are measured per module tick. */
export const ShipDefinitionSchema = EntityIdentitySchema.extend({
  category: z.literal('ship'),
  sizeClass: NonNegativeNumberSchema,
  fuelEfficiency: NonNegativeNumberSchema,
  cargoCapacity: NonNegativeNumberSchema,
  maximumHull: NonNegativeNumberSchema,
  maximumShields: NonNegativeNumberSchema,
  maximumSpeedPerFrame: NonNegativeNumberSchema,
  turnDegreesPerFrame: NonNegativeNumberSchema,
  basePrice: NonNegativeNumberSchema,
  startingWeaponIds: StartingWeaponIdsSchema,
}).strict().readonly();

export type ShipDefinition = z.infer<typeof ShipDefinitionSchema>;

/**
 * Immobile structure capabilities. Population changes are signed billions;
 * legacy table markers and unreviewed values belong in module provenance.
 */
export const StructureDefinitionSchema = EntityIdentitySchema.extend({
  category: z.literal('structure'),
  constructionScale: NonNegativeNumberSchema,
  populationChangeBillions: z.number().finite(),
  planetStrengthChange: NonNegativeNumberSchema,
  maximumHull: NonNegativeNumberSchema,
  maximumShields: NonNegativeNumberSchema,
  basePrice: NonNegativeNumberSchema,
  startingWeaponIds: StartingWeaponIdsSchema,
}).strict().readonly();

export type StructureDefinition = z.infer<typeof StructureDefinitionSchema>;

export const EntityDefinitionSchema = z.discriminatedUnion('category', [
  ShipDefinitionSchema,
  StructureDefinitionSchema,
]);

export type EntityDefinition = z.infer<typeof EntityDefinitionSchema>;

export const WeaponDefinitionSchema = z.object({
  id: PositiveIdSchema,
  name: z.string().min(1),
  description: z.string(),
  minimumSizeClass: NonNegativeNumberSchema,
  energyCost: NonNegativeNumberSchema,
  baseDamage: NonNegativeNumberSchema,
  cooldownFrames: NonNegativeNumberSchema,
  basePrice: NonNegativeNumberSchema,
}).strict().readonly();

export type WeaponDefinition = z.infer<typeof WeaponDefinitionSchema>;

export const GameContentSchema = z.object({
  entityDefinitions: z.array(EntityDefinitionSchema).min(1).readonly(),
  weaponDefinitions: z.array(WeaponDefinitionSchema).readonly(),
}).strict().superRefine((content, context) => {
  const entityIds = content.entityDefinitions.map(definition => definition.id);
  const weaponIdList = content.weaponDefinitions.map(definition => definition.id);
  const weaponIds = new Set(weaponIdList);
  if (new Set(entityIds).size !== entityIds.length) {
    context.addIssue({ code: 'custom', path: ['entityDefinitions'], message: 'Entity IDs must be unique.' });
  }
  if (weaponIds.size !== weaponIdList.length) {
    context.addIssue({ code: 'custom', path: ['weaponDefinitions'], message: 'Weapon IDs must be unique.' });
  }
  content.entityDefinitions.forEach((definition, definitionIndex) => {
    definition.startingWeaponIds.forEach((weaponId, slotIndex) => {
      if (weaponId === null || weaponIds.has(weaponId)) return;
      context.addIssue({
        code: 'custom',
        path: ['entityDefinitions', definitionIndex, 'startingWeaponIds', slotIndex],
        message: `Unknown weapon ID ${weaponId}.`,
      });
    });
  });
}).readonly();

export type GameContent = z.infer<typeof GameContentSchema>;
