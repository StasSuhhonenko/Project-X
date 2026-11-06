/** Adapt the final validated world into a frozen display contract and guarded exits. */
import type { AppStore, AppStoreState } from './app-store';
import type { GameModule } from '../content/game-module';
import { selectPlayerEntity, type WorldState } from '../simulation/model/world-state';
import { TerminalViewSchema, type TerminalView } from '../ui/terminal-presentation';
import type { SpatialPresentation, SpatialView } from '../rendering/contracts/spatial-presentation';

/** Host-only transient image ownership; never passed as a mutable renderer handle. */
export interface TerminalBackdrop {
  readonly world: WorldState;
  readonly sessionRevision: number;
  readonly image: string;
}

/** Cosmetic capture failures cannot delay death or prevent service disposal. */
export function captureTerminalBackdrop(store: AppStore, sessionRevision: number,
  view: SpatialView | null): TerminalBackdrop | null {
  const state = store.getState();
  if (!view || state.screen !== 'game' || state.world?.status !== 'player-destroyed'
    || state.sessionRevision !== sessionRevision) return null;
  try {
    const image = view.captureBackdrop?.();
    if (!image) return null;
    return Object.freeze({ world: state.world, sessionRevision, image });
  } catch {
    return null;
  }
}

/** Copy only final identity and sprite geometry; active gameplay owns no terminal view. */
export function selectTerminalView(state: AppStoreState, gameModule: GameModule,
  startedAtMs: number, projectPlayer?: SpatialPresentation['projectPlayer']): TerminalView | null {
  const world = state.world;
  if (state.screen !== 'game' || !world || world.status !== 'player-destroyed') return null;
  if (!state.activeStartId) throw new Error('Terminal session has no selected start.');
  const player = selectPlayerEntity(world);
  return TerminalViewSchema.parse({ status: world.status, startId: state.activeStartId,
    playerDefinitionId: player.definitionId, systemId: player.location.systemId, startedAtMs,
    headingDegrees: player.location.rotationDegrees,
    playerSpatial: projectPlayer?.(world) ?? null });
}

/** Reject delayed animation exits after restart, restore, menu or another terminal world. */
export function createTerminalIntents(store: AppStore, world: WorldState, sessionRevision: number) {
  const current = () => {
    const state = store.getState();
    return state.screen === 'game' && state.world === world && world.status === 'player-destroyed'
      && state.sessionRevision === sessionRevision;
  };
  return Object.freeze({
    onReturnToMenu: () => { if (current()) store.getState().returnToMenu(); },
    onRestart: () => { if (current()) store.getState().restartGame(); },
  });
}
