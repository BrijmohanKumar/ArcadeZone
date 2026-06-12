import type { UpgradeId } from "./upgrades";
import type { TankSkinId } from "./tankSkins";

export type UpgradeLevels = Record<UpgradeId, number>;

export type PlayerProgress = {
  schemaVersion: 1;
  coins: number;
  playerName: string;
  tankSkin: TankSkinId;
  playerLevel: number;
  totalMatches: number;
  totalWins: number;
  bestScore: number;
  tutorialSeen: boolean;
  upgrades: UpgradeLevels;
};

export const DEFAULT_PLAYER_PROGRESS: PlayerProgress = {
  schemaVersion: 1,
  coins: 250,
  playerName: "",
  tankSkin: "sky",
  playerLevel: 1,
  totalMatches: 0,
  totalWins: 0,
  bestScore: 0,
  tutorialSeen: false,
  upgrades: {
    healthBoost: 0,
    shieldBoost: 0,
    ammoEfficiency: 0
  }
};
