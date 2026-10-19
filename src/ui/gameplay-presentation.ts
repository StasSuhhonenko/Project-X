/** The concrete selected gameplay frame, with host-owned scene/tool slots. */
import type { ComponentType, ReactNode } from 'react';
import type { GameModuleDefinition } from '../content/schemas/game-module';
import type { GameHudView } from './game-hud-view';
import type { SelectedTargetView } from './selected-target-view';
import type { PlanetContactView, SelectedContactView } from './contact-view';

/**
 * The host owns viewport services, validated commands and save operations.
 * Modules consume a frozen HUD projection and own only presentation/navigation.
 * Static capacity/names remain in definition, keyed by hud.playerDefinitionId.
 * sliceTools exposes existing supported panels until their concrete replacement.
 */
export interface GameplayPresentationProps {
  readonly definition: GameModuleDefinition;
  readonly hud: GameHudView;
  readonly target: SelectedTargetView | null;
  /** Existing world facts for local contact inspection; no implied hail access. */
  readonly planetContact: PlanetContactView | null;
  readonly selectedContact: SelectedContactView | null;
  /** Clear authoritative selection through the existing validated command. */
  readonly onClearTarget: () => void;
  readonly viewport: ReactNode;
  readonly sliceTools: ReactNode;
  readonly saveTools: ReactNode;
  readonly onReturnToMenu: () => void;
  /** Report artwork readiness; blocked flight input never pauses world time. */
  readonly onInputAvailabilityChange: (available: boolean) => void;
}

export type GameplayPresentation = ComponentType<GameplayPresentationProps>;
