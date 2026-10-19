/** The bounded React entry capability supplied by the build-selected module. */
import type { ComponentType, ReactNode } from 'react';
import type { GameModuleDefinition } from '../content/schemas/game-module';

/**
 * Immutable content and named intents, never a writable application store.
 * onStart commits only a validated module start ID; preview/route state remains
 * presentation-owned. saveTools contains the host's validated browser adaptation;
 * the presentation chooses where to expose it without recreating storage rules.
 */
export interface EntryPresentationProps {
  readonly definition: GameModuleDefinition;
  readonly onStart: (startId: string) => void;
  readonly saveTools: ReactNode;
}

/** Build-time React capability, independent of simulation and save versions. */
export type EntryPresentation = ComponentType<EntryPresentationProps>;
