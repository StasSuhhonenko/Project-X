/** The concrete selected gameplay frame, with host-owned scene/tool slots. */
import type { ComponentType, ReactNode } from 'react';
import type { GameModuleDefinition } from '../content/schemas/game-module';
import type { PlayerIdentity } from '../simulation/model/player-identity';
import type { GameHudView } from './game-hud-view';
import type { SystemStandingView } from './system-standing-view';
import type { SelectedTargetView } from './selected-target-view';
import type { PlanetContactView, SelectedContactView } from './contact-view';
import type { RepairView } from './repair-view';
import type { PlayerSpatialView } from './player-spatial-view';
import type { PurchaseView } from './purchase-view';
import type { RouteView, RoutePhase, RouteErrorKind } from './route-view';
import type { TravelPresentationOptions, TravelPresentationView } from './travel-presentation-view';
import type { CommunicationView } from './communication-view';
import type { WorldActivation, SpatialOverview } from './spatial-overview-view';
import type { ParallaxLayer } from '../rendering/parallax-layer';

/**
 * The host owns viewport services, validated commands and save operations.
 * Modules consume a frozen HUD projection and own only presentation/navigation.
 * Static capacity/names remain in definition, keyed by hud.playerDefinitionId.
 * sliceTools exposes existing supported panels until their concrete replacement.
 */
export interface GameplayPresentationProps {
  readonly definition: GameModuleDefinition;
  /** Frozen display-only names; never mutable faction definitions or credentials. */
  readonly identity: PlayerIdentity | null;
  readonly hud: GameHudView;
  readonly standing: SystemStandingView | null;
  /** Latest outcome only; modules observe new revisions rather than replaying a save. */
  readonly communication: CommunicationView | null;
  /** Cosmetic sound for this displayed revision; rejects stale/session/duplicate calls. */
  readonly onPlayCommunicationCue: (sequence: number) => void;
  readonly target: SelectedTargetView | null;
  /** Existing world facts for local contact inspection; no implied hail access. */
  readonly planetContact: PlanetContactView | null;
  readonly selectedContact: SelectedContactView | null;
  /** One validated pointer activation; sequence distinguishes repeated clicks. */
  readonly worldActivation?: WorldActivation | null;
  readonly spatialOverview?: SpatialOverview;
  readonly repair: RepairView;
  readonly purchase: PurchaseView | null;
  readonly route: RouteView | null;
  readonly routePhase: RoutePhase;
  /** Loading facts become an arrival summary only after routePhase returns ready. */
  readonly travel: TravelPresentationView | null;
  /** Acknowledge a ready summary; cannot commit travel or acknowledge view readiness. */
  readonly onDismissTravel: () => void;
  readonly routeError: string | null;
  readonly routeErrorKind: RouteErrorKind | null;
  /** Changes on every refusal/failure, including repeated identical messages. */
  readonly routeErrorRevision: number;
  /** Bound to the displayed session, origin and selected destination. */
  readonly onSelectDestination: (systemId: number | null) => void;
  readonly onDepart: () => void;
  /** Select a marker and request departure in the same guarded host intent. */
  readonly onDepartTo: (systemId: number) => void;
  /** Bound to the displayed merchant/session; revalidates current quantities. */
  readonly onPurchaseCargo: (quantityTons: number) => void;
  readonly playerSpatial: PlayerSpatialView;
  /** Re-evaluate current eligibility/payment at dispatch; quotes are never approvals. */
  readonly onBeginRepair: () => void;
  /** Existing unrefunded cancellation; unmounting artwork does not cancel repair. */
  readonly onCancelRepair: () => void;
  /** Clear authoritative selection through the existing validated command. */
  readonly onClearTarget: () => void;
  readonly viewport: ReactNode;
  readonly sliceTools: ReactNode;
  readonly saveTools: ReactNode;
  readonly onReturnToMenu: () => void;
  /** Report artwork readiness; blocked flight input never pauses world time. */
  readonly onInputAvailabilityChange: (available: boolean) => void;
}

export type GameplayPresentation = ComponentType<GameplayPresentationProps> & {
  readonly travelPresentation?: TravelPresentationOptions;
  /** Module-owned artwork selection; scene loading, ordering and disposal stay
   * with the host. The background also appears in terminal scene captures. */
  readonly spatialPresentation?: Readonly<{
    backgroundImageForSystem: (systemId: number) => string;
    /** Called once per scene attachment with independent cosmetic entropy.
     * Stable through renders/resizes; must not consume simulation/save RNG. */
    parallaxLayersForSystem?: (systemId:number, presentationSeed:number) => readonly ParallaxLayer[];
  }>;
};
