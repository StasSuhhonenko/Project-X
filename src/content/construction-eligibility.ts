import type { EntityDefinition, StructureDefinition } from './schemas/game-content';

/** A plan must resolve to a structure whose hull plus shields can initialize
 * a completed station's positive, finite combat strength. Definitions used
 * without a construction plan can still have zero durability. */
export function isBuildableStructure(definition: EntityDefinition | undefined): definition is StructureDefinition {
  if (definition?.category !== 'structure') return false;
  const strength = definition.maximumHull + definition.maximumShields;
  return Number.isFinite(strength) && strength > 0;
}
