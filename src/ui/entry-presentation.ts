/** The bounded React entry capability supplied by the build-selected module. */
import type { ComponentType, ReactNode } from 'react';
import type { GameModuleDefinition } from '../content/schemas/game-module';
import type { PlayerIdentity } from '../simulation/model/player-identity';

/**
 * Immutable content and named intents, never a writable application store.
 * onStart commits a validated start and optional single-line display identity;
 * other preview/route state remains presentation-owned. saveTools contains the host's validated browser adaptation;
 * the presentation chooses where to expose it without recreating storage rules.
 */
export interface EntryPresentationProps {
  readonly definition: GameModuleDefinition;
  readonly onStart: (startId: string, identity?: PlayerIdentity) => void;
  readonly saveTools: ReactNode;
  /**
   * Call once when the complete entry (every route the presentation can show
   * without further loading) is displayed. The host then warms gameplay code in
   * the background, so it never competes with the entry's own first requests.
   * Optional: an entry that never reports simply gets no background warmup.
   */
  readonly onPrepared?: () => void;
}

/** Build-time React capability, independent of simulation and save versions. */
export type EntryPresentation = ComponentType<EntryPresentationProps>;
