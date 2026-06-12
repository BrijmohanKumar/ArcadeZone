type PlayablesGameApi = {
  firstFrameReady?: () => void;
  gameReady?: () => void;
  loadData?: () => Promise<string | null>;
  saveData?: (data: string) => Promise<void>;
};

type PlayablesSystemApi = {
  isAudioEnabled?: () => boolean;
  onAudioEnabledChange?: (callback: (enabled: boolean) => void) => void;
  onPause?: (callback: () => void) => void;
  onResume?: (callback: () => void) => void;
};

type PlayablesGlobal = {
  game?: PlayablesGameApi;
  system?: PlayablesSystemApi;
};

declare global {
  interface Window {
    ytgame?: PlayablesGlobal;
  }
}

export class PlayablesBridge {
  private static readonly DATA_TIMEOUT_MS = 900;
  private firstFrameSent = false;
  private readySent = false;

  firstFrameReady(): void {
    if (this.firstFrameSent) {
      return;
    }

    this.firstFrameSent = true;
    this.callSafely(() => window.ytgame?.game?.firstFrameReady?.());
  }

  gameReady(): void {
    if (this.readySent) {
      return;
    }

    this.readySent = true;
    this.callSafely(() => window.ytgame?.game?.gameReady?.());
  }

  async loadData<T>(fallback: T): Promise<T> {
    try {
      const loadData = window.ytgame?.game?.loadData;

      if (!loadData) {
        return fallback;
      }

      const rawValue = await Promise.race([
        loadData(),
        new Promise<string | null>((resolve) => {
          window.setTimeout(() => resolve(null), PlayablesBridge.DATA_TIMEOUT_MS);
        })
      ]);

      return rawValue ? (JSON.parse(rawValue) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  async saveData<T>(value: T): Promise<void> {
    try {
      await window.ytgame?.game?.saveData?.(JSON.stringify(value));
    } catch {
      // The local browser build runs without the Playables SDK.
    }
  }

  isAudioEnabled(): boolean {
    return window.ytgame?.system?.isAudioEnabled?.() ?? true;
  }

  onPause(callback: () => void): void {
    this.callSafely(() => window.ytgame?.system?.onPause?.(callback));
  }

  onResume(callback: () => void): void {
    this.callSafely(() => window.ytgame?.system?.onResume?.(callback));
  }

  onAudioEnabledChange(callback: (enabled: boolean) => void): void {
    this.callSafely(() => window.ytgame?.system?.onAudioEnabledChange?.(callback));
  }

  private callSafely(action: () => void): void {
    try {
      action();
    } catch {
      // SDK calls should never break the standalone browser build.
    }
  }
}

export const playablesBridge = new PlayablesBridge();
