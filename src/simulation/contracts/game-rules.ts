/**
 * Trusted module behavior injected by the composition root. Modules receive
 * immutable state and definitions, never a store setter, renderer, or browser.
 * One call advances one module-defined tick and must return a frozen snapshot.
 * This is a code extension contract, not a sandbox for untrusted downloads.
 */
import type { ShipDefinition } from '../../content/schemas/game-content';
import type { PlayerControls } from '../commands/player-controls';
import type { PlayerState } from '../model/player-state';

export interface GameRules {
  readonly apiVersion: 1;
  readonly moduleId: string;
  updatePlayerMovement(player: PlayerState, vessel: ShipDefinition, controls: Readonly<PlayerControls>): PlayerState;
}
