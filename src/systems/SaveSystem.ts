import { DEFAULT_PLAYER_PROGRESS, type PlayerProgress } from "../data/saveData";
import { getTankSkin } from "../data/tankSkins";
import { LocalStorageAdapter } from "../platform/LocalStorageAdapter";
import { playablesBridge } from "../platform/PlayablesBridge";

const PROGRESS_KEY = "player-progress";

export class SaveSystem {
  private readonly storage = new LocalStorageAdapter();

  loadProgress(): PlayerProgress {
    return this.normalizeProgress(this.storage.load<PlayerProgress>(PROGRESS_KEY, DEFAULT_PLAYER_PROGRESS));
  }

  async hydrateFromPlatform(): Promise<void> {
    const platformProgress = await playablesBridge.loadData<PlayerProgress | null>(null);

    if (!platformProgress) {
      return;
    }

    this.saveProgress(platformProgress, false);
  }

  saveProgress(progress: PlayerProgress, syncPlatform = true): void {
    const normalizedProgress = this.normalizeProgress(progress);

    this.storage.save(PROGRESS_KEY, normalizedProgress);

    if (syncPlatform) {
      void playablesBridge.saveData(normalizedProgress);
    }
  }

  private normalizeProgress(progress: Partial<PlayerProgress>): PlayerProgress {
    const merged: PlayerProgress = {
      ...DEFAULT_PLAYER_PROGRESS,
      ...progress,
      upgrades: {
        ...DEFAULT_PLAYER_PROGRESS.upgrades,
        ...progress.upgrades
      }
    };

    return {
      ...merged,
      tankSkin: getTankSkin(merged.tankSkin).id
    };
  }

  markTutorialSeen(): void {
    const progress = this.loadProgress();

    if (progress.tutorialSeen) {
      return;
    }

    this.saveProgress({
      ...progress,
      tutorialSeen: true
    });
  }

  updatePlayerName(playerName: string): void {
    const progress = this.loadProgress();

    this.saveProgress({
      ...progress,
      playerName
    });
  }

  updateTankSkin(tankSkin: string): void {
    const progress = this.loadProgress();

    this.saveProgress({
      ...progress,
      tankSkin: getTankSkin(tankSkin).id
    });
  }
}

export const saveSystem = new SaveSystem();
