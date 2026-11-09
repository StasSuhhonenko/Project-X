/** The concrete selected gameplay frame, with host-owned scene/tool slots. */
import type { ComponentType, ReactNode } from 'react';
import type { GameModuleDefinition } from '../content/schemas/game-module';
import type { ResourceSaleIntent } from '../simulation/contracts/cargo-trade';
import type { ResourcePurchaseIntent, ResourcePurchaseResult } from '../simulation/contracts/resource-purchase';
import type { EquipmentIntent } from '../simulation/features/equipment';
import type { VesselPurchaseIntent } from '../simulation/features/vessel-purchase';
import type { CargoTradeIntent, CargoTradeRefusal } from '../simulation/model/cargo-transactions';
import type { ContractOfferRef } from '../simulation/model/mission-state';
import type { PlayerIdentity } from '../simulation/model/player-identity';
import type { ActorDeathSource } from './actor-death-source';
import type { CargoHoldView, CommodityMarketView, ResourceSalesView } from './cargo-trade-view';
import type { CommunicationView } from './communication-view';
import type { PlanetContactView, SelectedContactView } from './contact-view';
import type { EquipmentView } from './equipment-view';
import type { GameHudView } from './game-hud-view';
import type { MissionView } from './mission-view';
import type { PlayerSpatialView } from './player-spatial-view';
import type { ProgressionView } from './progression-view';
import type { PurchaseView } from './purchase-view';
import type { RepairView } from './repair-view';
import type { RouteErrorKind, RoutePhase, RouteView } from './route-view';
import type { SelectedTargetView } from './selected-target-view';
import type { SpatialOverview, WorldActivation } from './spatial-overview-view';
import type { SystemStandingView } from './system-standing-view';
import type { TravelPresentationOptions, TravelPresentationView } from './travel-presentation-view';
import type { VesselOfferView } from './vessel-purchase-view';

/**
 * The host owns viewport services, validated commands and save operations.
 * Modules consume a frozen HUD projection and own only presentation/navigation.
 * Static capacity/names remain in definition, keyed by hud.playerDefinitionId.
 * sliceTools exposes existing supported panels until their concrete replacement.
 */
export interface GameplayPresentationProps {
  readonly missions?: MissionView | null;
  readonly onAcceptContract?: (ref: ContractOfferRef) => boolean;
  readonly onNegotiateContract?: (ref: ContractOfferRef) => boolean;
  readonly onTransportToSurface?: () => boolean;
  readonly cargoHold?: CargoHoldView | null;
  readonly commodityMarket?: CommodityMarketView | null;
  readonly onCargoTrade?: ((intent: CargoTradeIntent) => CargoTradeRefusal | null) | undefined;
  readonly resourceSales?: ResourceSalesView | null;
  readonly onSellResource?: ((intent: ResourceSaleIntent) => boolean) | undefined;
  readonly onPurchaseResource?: ((intent: ResourcePurchaseIntent) => ResourcePurchaseResult | null) | undefined;
  readonly definition: GameModuleDefinition;
  /** Frozen display-only names; never mutable faction definitions or credentials. */
  readonly identity: PlayerIdentity | null;
  readonly hud: GameHudView;
  readonly standing: SystemStandingView | null;
  /** Frozen simulation facts; optional for presentations without status consumers. */
  readonly progression?: ProgressionView | null;
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
  /** Every completed publication, for optional module death artwork. */
  readonly actorDeathSource?: ActorDeathSource;
  readonly repair: RepairView;
  readonly purchase: PurchaseView | null;
  readonly equipment?: EquipmentView | null | undefined;
  readonly onEquipmentCommand?: ((intent: EquipmentIntent) => void) | undefined;
  readonly vesselOffers: readonly VesselOfferView[];
  readonly vesselPurchaseBusy: boolean;
  readonly vesselPurchaseError: string | null;
  readonly onPurchaseVessel: (intent: VesselPurchaseIntent) => void;
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
  readonly playerSpatial: PlayerSpatialView | null;
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
  /**
   * False while the host prepares this scene invisibly beneath the previous
   * screen (menu, death screen or prior session). Until it is true the
   * presentation must not attach its own input listeners, start clocks or play
   * audio. The host already withholds simulation ticks and flight input.
   */
  readonly revealed: boolean;
  /**
   * Report whether everything the presentation needs to show its complete first
   * view (artwork, and resources for interactions it exposes immediately) is
   * prepared. The host reveals the scene only after `ready` and a first complete
   * spatial frame; `failed` keeps the previous screen with retry/cancel recovery.
   * Report again whenever the state changes; the host ignores reports after
   * reveal, so later incremental preparation never hides a shown scene.
   */
  readonly onPresentationReadyChange: (readiness: PresentationReadiness) => void;
}

/** Presentation preparation state reported to the host's scene reveal gate. */
export type PresentationReadiness = 'pending' | 'ready' | 'failed';

export type GameplayPresentation = ComponentType<GameplayPresentationProps> & {
  readonly travelPresentation?: TravelPresentationOptions;
};
