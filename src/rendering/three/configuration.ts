/** Bounded Three.js presentation configuration. No renderer can be selected by
 * this JSON: the trusted module entry has already chosen this implementation. */
import { z } from 'zod';
import type { GameModuleDefinition } from '../../content/schemas/game-module';
import { CloakAppearanceSchema } from '../shared/actor-opacity';

const positive = z.number().finite().positive();
const definitionId = z.number().int().positive();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const ThreeSpatialConfigurationSchema = z
  .object({
    schemaVersion: z.literal(1),
    moduleId: z.string().min(1),
    moduleVersion: z.string().min(1),
    camera: z
      .object({
        elevationDegrees: z.number().finite().min(15).max(85),
        azimuthDegrees: z.number().finite().min(-180).max(180),
        worldUnitsPerPixel: positive.max(10),
      })
      .strict()
      .readonly(),
    model: z.string().regex(/^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.glb$/),
    background: color,
    entities: z
      .array(
        z
          .object({
            entityDefinitionId: definitionId,
            shape: z.enum(['model', 'ship', 'station']),
            color,
            size: z
              .object({ x: positive.max(1000), y: positive.max(1000), z: positive.max(1000) })
              .strict()
              .readonly(),
          })
          .strict()
          .readonly()
      )
      .min(1)
      .readonly(),
    planet: z
      .object({ radius: positive.max(1000), color })
      .strict()
      .readonly(),
    weapons: z
      .array(
        z
          .object({
            weaponDefinitionId: definitionId,
            kind: z.enum(['beam', 'projectile', 'pulse', 'tractor', 'cloak', 'no-effect']),
            color,
          })
          .strict()
          .readonly()
      )
      .readonly(),
    effects: z
      .array(
        z
          .object({ effectDefinitionId: z.string().min(1), color })
          .strict()
          .readonly()
      )
      .readonly(),
    cloak: CloakAppearanceSchema,
  })
  .strict()
  .readonly();
export type ThreeSpatialConfiguration = z.infer<typeof ThreeSpatialConfigurationSchema>;

export function validateThreeConfiguration(game: GameModuleDefinition, input: unknown): ThreeSpatialConfiguration {
  const config = ThreeSpatialConfigurationSchema.parse(input);
  if (config.moduleId !== game.id || config.moduleVersion !== game.version)
    throw new Error('Three configuration differs from the selected gameplay module.');
  const unique = (ids: readonly (number | string)[]) => new Set(ids).size === ids.length;
  if (
    !unique(config.entities.map(item => item.entityDefinitionId)) ||
    !unique(config.weapons.map(item => item.weaponDefinitionId)) ||
    !unique(config.effects.map(item => item.effectDefinitionId))
  )
    throw new Error('Three mapping IDs must be unique.');
  if (
    config.entities.some(
      item => !game.content.entityDefinitions.some(entity => entity.id === item.entityDefinitionId)
    ) ||
    config.weapons.some(item => !game.content.weaponDefinitions.some(weapon => weapon.id === item.weaponDefinitionId))
  )
    throw new Error('Three configuration references unknown gameplay definitions.');
  // Include every supported old launch hull, lifecycle spawn and replacement.
  if (
    game.combatGeometry.entities.some(
      item => !config.entities.some(mapping => mapping.entityDefinitionId === item.entityDefinitionId)
    ) ||
    game.combatGeometry.specialEffects.some(
      item => !config.effects.some(mapping => mapping.effectDefinitionId === item.id)
    ) ||
    (game.equipment?.supportedWeaponIds ?? []).some(
      id => !config.weapons.some(mapping => mapping.weaponDefinitionId === id)
    )
  )
    throw new Error('Three presentation coverage is incomplete.');
  return config;
}

export async function loadThreeConfiguration(game: GameModuleDefinition, fetcher: typeof fetch = fetch) {
  const response = await fetcher('/game/spatial.json');
  if (!response.ok) throw new Error(`Could not load spatial configuration: HTTP ${response.status}.`);
  return validateThreeConfiguration(game, await response.json());
}
