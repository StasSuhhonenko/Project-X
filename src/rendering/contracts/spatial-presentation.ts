/** Library-free spatial boundary. Worlds are completed immutable snapshots;
 * intents authorize semantic commands separately from read/subscription access. */
import { z } from 'zod';
import type { WorldState } from '../../simulation/model/world-state';
import type { PlayerSpatialView } from '../../ui/player-spatial-view';
import type { PresentationFrame } from '../shared/presentation-timing';

export const SpatialActivationSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['planet', 'station', 'npc-ship']),
  selectedBefore: z.boolean(),
}).strict().readonly();
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
export interface SpatialView {
  render(alpha: number, frame?: PresentationFrame): void;
  reset(): void;
  setPlayerVisible?(visible: boolean): void;
  captureBackdrop?(): string | null;
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
