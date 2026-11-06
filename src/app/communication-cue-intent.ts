/** Bind optional communication audio to a live outcome and its scene lifetime. */
import type { AudioCue } from '../platform/browser/browser-audio-cue';
import { selectPlayerEntity } from '../simulation/model/world-state';
import type { AppStore } from './app-store';

/** Scene-local observation state grants no simulation mutation or persistence.
 * The mounted sequence is historical, including after restore/system remount.
 * Each returned intent binds its displayed revision; disposal makes old handles
 * inert even if a later visit reuses the same system and session identifiers. */
function mountedSequence(store: AppStore): number {
  const initialWorld = store.getState().world;
  return initialWorld ? (selectPlayerEntity(initialWorld).feedback.communication?.sequence ?? 0) : 0;
}

function createOwnedCue(
  store: AppStore,
  sessionRevision: number,
  systemId: number | null,
  cue: AudioCue,
  blocked: () => boolean,
  baselineSequence: number,
  onPlayed: (sequence: number) => void
) {
  let playedSequence = baselineSequence;
  let disposed = false;
  return {
    intent:
      (displayedSequence: number | null): ((sequence: number) => void) =>
      sequence => {
        if (
          disposed ||
          blocked() ||
          displayedSequence === null ||
          displayedSequence !== sequence ||
          sequence <= playedSequence
        )
          return;
        const state = store.getState();
        if (state.screen !== 'game' || state.sessionRevision !== sessionRevision) return;
        const world = state.world;
        if (!world || world.status !== 'active') return;
        const player = selectPlayerEntity(world);
        if (player.location.systemId !== systemId || player.feedback.communication?.sequence !== sequence) return;
        playedSequence = sequence;
        onPlayed(sequence);
        cue.play();
      },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      cue.stop();
    },
  };
}

export function createCommunicationCueOwner(
  store: AppStore,
  sessionRevision: number,
  systemId: number | null,
  cue: AudioCue,
  blocked: () => boolean
) {
  return createOwnedCue(store, sessionRevision, systemId, cue, blocked, mountedSequence(store), () => {});
}

/** React can replay effect setup/cleanup in the same committed scene. Replace a
 * disposed owner rather than reviving it; preserve the mounted/played revision
 * across that replay so an already attempted cue never plays twice. Real scene
 * replacement creates a different lifetime, leaving all old callbacks inactive.
 * Creating cue handles is lazy; Audio objects still begin only on a live intent. */
export function createCommunicationCueLifetime(
  store: AppStore,
  sessionRevision: number,
  systemId: number | null,
  createCue: () => AudioCue,
  blocked: () => boolean
) {
  let observedSequence = mountedSequence(store);
  const replaceOwner = () =>
    createOwnedCue(store, sessionRevision, systemId, createCue(), blocked, observedSequence, sequence => {
      observedSequence = sequence;
    });
  let owner: ReturnType<typeof createOwnedCue> | null = replaceOwner();
  return {
    activate: () => {
      owner ??= replaceOwner();
    },
    intent:
      (displayedSequence: number | null): ((sequence: number) => void) =>
      sequence =>
        owner?.intent(displayedSequence)(sequence),
    deactivate: () => {
      owner?.dispose();
      owner = null;
    },
  };
}
