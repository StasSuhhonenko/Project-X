/** Page1:25841 writers192/194 consume only committed captain/ship identity.
 * Government name has save/diplomacy consumers, but none in this bounded HUD. */
import type { PlayerIdentity } from '../../../src/simulation/model/player-identity';
import type { GameModuleDefinition } from '../../../src/content/schemas/game-module';

/** Exact source punctuation; blank names and leading/trailing spaces survive. */
export function createIdentityReadModel(identity: PlayerIdentity | null, playerDefinitionId: number, definition: GameModuleDefinition) {
  if (!identity) return Object.freeze({ playername: '', playership: '' });
  const vessel = definition.content.entityDefinitions.find(vessel => vessel.id === playerDefinitionId && vessel.category === 'ship');
  if (!vessel) throw new Error('Identity vessel definition is unavailable');
  return Object.freeze({ playername: identity.captainName, playership: `${identity.shipName}, ${vessel.name}` });
}
