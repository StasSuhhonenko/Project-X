/** Encapsulated, immutable lookups over validated base content. */
import type {
  GameContent,
  EntityDefinition,
  ShipDefinition,
  StructureDefinition,
  WeaponDefinition,
} from './schemas/game-content';

export interface ContentCatalog {
  getEntityDefinition(id: number): EntityDefinition | undefined;
  getShipDefinition(id: number): ShipDefinition | undefined;
  getStructureDefinition(id: number): StructureDefinition | undefined;
  getWeaponDefinition(id: number): WeaponDefinition | undefined;
  getEntityDefinitions(): readonly EntityDefinition[];
  getWeaponDefinitions(): readonly WeaponDefinition[];
}

/**
 * Copies and freezes definitions so callers cannot mutate catalog state through
 * aliases retained from parsed JSON or returned lookup values.
 */
export function createContentCatalog(content: GameContent): ContentCatalog {
  const entityDefinitions: readonly EntityDefinition[] = Object.freeze(content.entityDefinitions.map(definition => {
    // Spell out the fixed slots so the runtime copy preserves the schema's
    // three-element tuple contract under strict unchecked-index handling.
    const startingWeaponIds = Object.freeze([
      definition.startingWeaponIds[0],
      definition.startingWeaponIds[1],
      definition.startingWeaponIds[2],
    ] as const);
    if (definition.category === 'ship') {
      return Object.freeze({ ...definition, startingWeaponIds });
    }
    return Object.freeze({ ...definition, startingWeaponIds });
  }));
  const weaponDefinitions: readonly WeaponDefinition[] = Object.freeze(
    content.weaponDefinitions.map(definition => Object.freeze({ ...definition })),
  );
  const entitiesById = new Map(entityDefinitions.map(definition => [definition.id, definition]));
  const shipsById = new Map(
    entityDefinitions
      .filter((definition): definition is ShipDefinition => definition.category === 'ship')
      .map(definition => [definition.id, definition]),
  );
  const structuresById = new Map(
    entityDefinitions
      .filter((definition): definition is StructureDefinition => definition.category === 'structure')
      .map(definition => [definition.id, definition]),
  );
  const weaponsById = new Map(weaponDefinitions.map(definition => [definition.id, definition]));

  return Object.freeze({
    getEntityDefinition: (id: number) => entitiesById.get(id),
    getShipDefinition: (id: number) => shipsById.get(id),
    getStructureDefinition: (id: number) => structuresById.get(id),
    getWeaponDefinition: (id: number) => weaponsById.get(id),
    getEntityDefinitions: () => entityDefinitions,
    getWeaponDefinitions: () => weaponDefinitions,
  });
}
