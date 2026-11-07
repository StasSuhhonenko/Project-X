/** Library-free spatial boundary. Worlds are completed immutable snapshots;
 * intents authorize semantic commands separately from read/subscription access. */
import { z } from 'zod';
import type { WorldState } from '../../simulation/model/world-state';
import type { PlayerSpatialView } from '../../ui/player-spatial-view';
import type { PresentationFrame } from '../shared/presentation-timing';

export const SpatialActivationSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['planet', 'station', 'npc-ship']),
    selectedBefore: z.boolean(),
  })
  .strict()
  .readonly();
export type SpatialActivation = z.infer<typeof SpatialActivationSchema>;

export interface SpatialSnapshot {
  readonly world: WorldState | null;
  readonly sessionRevision: number;
}
export interface SpatialStateSource {
  getState(): SpatialSnapshot;
  subscribe(listener: (state: SpatialSnapshot) => void): () => void;
}
export interface SpatialIntents {
  selectTarget(id: string | null): void;
  activate(contact: SpatialActivation | null): void;
}
/** A synchronous copy of the displayed frame and where it was on screen. */
export interface SpatialStill {
  /** Detached canvas owned by the caller; displays without any decode step. */
  readonly image: HTMLCanvasElement;
  /** Viewport-relative CSS pixel bounds of the live view at capture time. */
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}
export interface SpatialView {
  render(alpha: number, frame?: PresentationFrame): void;
  reset(): void;
  setPlayerVisible?(visible: boolean): void;
  captureBackdrop?(): string | null;
  /**
   * Copy the frame as last displayed (player included) for covering a session
   * transition. Synchronous, so the cover is complete in the same commit that
   * replaces this view. Optional: without it the host shows a plain cover.
   */
  captureStill?(): SpatialStill | null;
  /** Remove only resources owned by this attachment; safe to repeat. */
  dispose(): void;
}
export interface ScenePreparationRequest {
  readonly world: WorldState;
  readonly sessionRevision: number;
  readonly generation: number;
  /** Independent cosmetic entropy, never the simulation random stream. */
  readonly cosmeticSeed: number;
  readonly signal: AbortSignal;
}
export interface SpatialAttachment {
  readonly host: HTMLElement;
  readonly source: SpatialStateSource;
  readonly intents: SpatialIntents;
}
export interface PreparedSpatialScene {
  attach(context: SpatialAttachment): Promise<SpatialView>;
  /** Release preparation leases after all attachment work is settled. */
  dispose(): void;
}
export interface SpatialPresentation {
  prepareScene(request: ScenePreparationRequest): Promise<PreparedSpatialScene>;
  /** Synchronous committed-snapshot projection, including terminal restore.
   * Null means this module uses no actor overlay; it never hides gameplay UI. */
  projectPlayer?(world: WorldState): PlayerSpatialView | null;
  /** Application-lifetime caches have an explicit owner and teardown. */
  dispose(): void;
}
