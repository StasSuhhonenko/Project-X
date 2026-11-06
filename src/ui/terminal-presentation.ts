/** Build-selected terminal presentation; no active spatial services cross this seam. */
import type { ComponentType, ReactNode } from 'react';
import { z } from 'zod';
import type { GameModuleDefinition } from '../content/schemas/game-module';
import { PositiveDefinitionIdSchema, SystemIdSchema } from '../simulation/model/entity-components';
import { PlayerSpatialViewSchema } from './player-spatial-view';

/** Frozen final player facts; animation clocks never advance the terminal world. */
export const TerminalViewSchema = z.object({
  status: z.literal('player-destroyed'),
  startId: z.string().min(1),
  playerDefinitionId: PositiveDefinitionIdSchema,
  systemId: SystemIdSchema,
  playerSpatial: PlayerSpatialViewSchema.nullable(),
  headingDegrees: z.number().finite(),
  /** Host monotonic epoch in performance.now() milliseconds, reset on session replacement. */
  startedAtMs: z.number().finite().nonnegative(),
}).strict().readonly();
export type TerminalView = z.infer<typeof TerminalViewSchema>;

/** Intents bind the exact terminal session; no world/store handles are exposed. */
export interface TerminalPresentationProps {
  readonly definition: GameModuleDefinition;
  readonly terminal: TerminalView;
  /** Frozen source-world image slot; null after restore or unavailable capture. */
  readonly backdrop: ReactNode;
  readonly onReturnToMenu: () => void;
  /** Explicit browser recovery reconstructs the original selected start. */
  readonly onRestart: () => void;
  readonly saveTools: ReactNode;
}
export type TerminalPresentation = ComponentType<TerminalPresentationProps>;
