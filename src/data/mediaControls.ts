import { MediaSession } from "@capgo/capacitor-media-session";

// The system's media controls: Android's media notification and lock screen
// (through the plugin's foreground service, which also keeps recitation
// playing with the app in the background) and the browser's Media Session on
// the desktop. Every call is best-effort: a platform without it is ignored.

export interface MediaHandlers {
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  stop: () => void;
}

export interface NowPlaying {
  /** "Qaf 50:16" */
  title: string;
  /** The reciter. */
  artist: string;
  album: string;
  playing: boolean;
  /** Seconds into the range, and the range's length. */
  position: number;
  duration: number;
  rate: number;
}

const quiet = (p: Promise<unknown>) => {
  p.catch(() => {});
};

/** Route the system's buttons to the player; returns the undo. */
export function bindMediaControls(h: MediaHandlers): () => void {
  const map = {
    play: h.play,
    pause: h.pause,
    nexttrack: h.next,
    previoustrack: h.previous,
    stop: h.stop,
  } as const;
  const actions = Object.keys(map) as (keyof typeof map)[];
  for (const action of actions)
    quiet(MediaSession.setActionHandler({ action }, () => map[action]()));
  return () => {
    for (const action of actions) quiet(MediaSession.setActionHandler({ action }, null));
    clearNowPlaying();
  };
}

export function showNowPlaying(n: NowPlaying): void {
  quiet(MediaSession.setMetadata({ title: n.title, artist: n.artist, album: n.album }));
  quiet(
    MediaSession.setPlaybackState({ playbackState: n.playing ? "playing" : "paused" }),
  );
  if (n.duration > 0 && Number.isFinite(n.duration))
    quiet(
      MediaSession.setPositionState({
        duration: n.duration,
        position: Math.min(Math.max(0, n.position), n.duration),
        playbackRate: n.rate,
      }),
    );
}

/** Nothing is loaded any more: the notification goes away. */
export function clearNowPlaying(): void {
  quiet(MediaSession.setPlaybackState({ playbackState: "none" }));
}
