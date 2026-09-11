/** Validate a module atomically before exposing its immutable content or rules. */
import type { GameRules } from '../simulation/contracts/game-rules';
import { createContentCatalog, type ContentCatalog } from './content-catalog';
import { GameModuleSchema, type GameModuleDefinition } from './schemas/game-module';

export interface GameModule {
  readonly definition: GameModuleDefinition;
  readonly catalog: ContentCatalog;
  readonly rules: GameRules;
}

/** Only reviewed local code may supply rules; JSON cannot name/import executable code. */
export function createGameModule(input: unknown, rules: GameRules): GameModule {
  const definition = GameModuleSchema.parse(input);
  if (rules.apiVersion !== 1 || rules.moduleId !== definition.id || typeof rules.updatePlayerMovement !== 'function') {
    throw new Error('Selected module rules do not match the content or engine API.');
  }
  return Object.freeze({ definition, catalog: createContentCatalog(definition.content), rules: Object.freeze({ ...rules }) });
}

/** Fetch only the selected build's document; rejected loads never create a store. */
export async function loadGameModule(rules: GameRules, fetcher: typeof fetch = fetch): Promise<GameModule> {
  const response = await fetcher('/game/module.json');
  if (!response.ok) throw new Error(`Could not load game module: HTTP ${response.status}.`);
  return createGameModule(await response.json(), rules);
}
