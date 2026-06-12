let hasAttemptedLandscapeLock = false;

type OrientationWithLock = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

export async function tryEnterLandscapeMode(): Promise<void> {
  const isSmallPortrait = window.matchMedia("(orientation: portrait) and (max-width: 900px)").matches;

  if (!isSmallPortrait || hasAttemptedLandscapeLock) {
    return;
  }

  hasAttemptedLandscapeLock = true;

  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    }

    const orientation = screen.orientation as OrientationWithLock | undefined;
    await orientation?.lock?.("landscape");
  } catch {
    hasAttemptedLandscapeLock = false;
  }
}

export function installLandscapeModePrompt(): void {
  const attemptLock = (): void => {
    void tryEnterLandscapeMode();
  };

  window.addEventListener("pointerdown", attemptLock, { capture: true, passive: true });
  window.addEventListener("orientationchange", () => {
    hasAttemptedLandscapeLock = false;
  });
}
