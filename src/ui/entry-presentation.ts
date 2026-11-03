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
}

/** Build-time React capability, independent of simulation and save versions. */
export type EntryPresentation = ComponentType<EntryPresentationProps>;
