/** A scene-owned optional sound. Audio is cosmetic and cannot approve commands. */
export interface AudioCue {
  play(): void;
  stop(): void;
}

/** Create lazily after a live presentation intent, so restored historical
 * outcomes create no Audio object. The caller owns stop on scene disposal.
 * Validated module content supplies the URL; autoplay/device errors are inert. */
export function createBrowserAudioCue(
  url: string | null,
  createAudio: (source: string) => HTMLAudioElement = source => new Audio(source)
): AudioCue {
  let current: HTMLAudioElement | null = null;
  const stop = () => {
    const audio = current;
    current = null;
    try {
      audio?.pause();
    } catch {
      /* A device failure cannot block scene disposal. */
    }
  };
  return {
    play: () => {
      stop();
      if (!url) return;
      try {
        const audio = createAudio(url);
        current = audio;
        void audio.play().catch(() => {
          if (current === audio) current = null;
        });
      } catch {
        current = null;
      }
    },
    stop,
  };
}
