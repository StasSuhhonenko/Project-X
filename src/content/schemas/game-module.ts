/** Versioned module boundary, including cross-references needed by navigation. */
import { z } from 'zod';
import { PlayerStateSchema } from '../../simulation/model/player-state';
import { GameContentSchema } from './game-content';

const Id = z.string().regex(/^[a-z][a-z0-9-]*$/);
const PositiveId = z.number().int().positive();
// Restrict assets to local module paths: no schemes, traversal, queries, or
// percent-encoded separators. Build tooling supplies the selected public root.
const AssetPath = z.string().regex(/^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:png|jpg|webp|svg)$/);

export const GameModuleSchema = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  version: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string(),
  notice: z.string(),
  framesPerSecond: z.number().finite().positive().max(240),
  viewport: z.object({
    width: z.number().int().positive().max(8192),
    height: z.number().int().positive().max(8192),
  }).strict().readonly(),
  content: GameContentSchema,
  resources: z.array(z.object({ id: Id, label: z.string().min(1) }).strict().readonly()).readonly(),
  // These are identity/name records only, not a claim that map simulation exists.
  systems: z.array(z.object({ id: PositiveId, name: z.string().min(1) }).strict().readonly()).min(1).readonly(),
  starts: z.array(z.object({
    id: Id,
    label: z.string().min(1),
    player: PlayerStateSchema,
  }).strict().readonly()).min(1).readonly(),
  visuals: z.array(z.object({
    entityDefinitionId: PositiveId,
    image: AssetPath,
    anchor: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict().readonly(),
  }).strict().readonly()).min(1).readonly(),
}).strict().superRefine((module, context) => {
  const fail = (path: (string | number)[], message: string) => context.addIssue({ code: 'custom', path, message });
  const unique = (values: readonly (string | number)[], field: string) => {
    if (new Set(values).size !== values.length) fail([field], `${field} IDs must be unique.`);
  };
  unique(module.resources.map(value => value.id), 'resources');
  unique(module.systems.map(value => value.id), 'systems');
  unique(module.starts.map(value => value.id), 'starts');
  unique(module.visuals.map(value => value.entityDefinitionId), 'visuals');
  module.visuals.forEach((visual, index) => {
    if (!module.content.entityDefinitions.some(entity => entity.id === visual.entityDefinitionId)) {
      fail(['visuals', index], 'Visual references an unknown entity.');
    }
  });
  module.starts.forEach((start, index) => {
    const ship = module.content.entityDefinitions.find(entity => entity.id === start.player.entityDefinitionId && entity.category === 'ship');
    if (!ship) fail(['starts', index], 'Start must reference a ship.');
    if (ship && (start.player.hull > ship.maximumHull || start.player.shields > ship.maximumShields)) {
      fail(['starts', index], 'Starting durability exceeds vessel limits.');
    }
    if (!module.systems.some(system => system.id === start.player.systemId)) fail(['starts', index], 'Unknown starting system.');
    if (!module.visuals.some(visual => visual.entityDefinitionId === start.player.entityDefinitionId)) fail(['starts', index], 'Starting ship needs a visual.');
    const keys = Object.keys(start.player.resources);
    if (keys.length !== module.resources.length || !module.resources.every(resource => keys.includes(resource.id))) {
      fail(['starts', index, 'player', 'resources'], 'Starting resources must match the declared resource IDs.');
    }
  });
}).readonly();

export type GameModuleDefinition = z.infer<typeof GameModuleSchema>;
