import Phaser from "phaser";
import { BootScene } from "../scenes/BootScene";
import { HowToPlayScene } from "../scenes/HowToPlayScene";
import { LobbyScene } from "../scenes/LobbyScene";
import { MatchScene } from "../scenes/MatchScene";
import { MenuScene } from "../scenes/MenuScene";
import { ResultsScene } from "../scenes/ResultsScene";
import { SettingsScene } from "../scenes/SettingsScene";
import { UpgradeScene } from "../scenes/UpgradeScene";
import { GAME_HEIGHT, GAME_WIDTH, Palette } from "./constants";

export function createGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: "game-root",
    backgroundColor: Palette.background,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false
    },
    scene: [BootScene, MenuScene, LobbyScene, HowToPlayScene, UpgradeScene, SettingsScene, MatchScene, ResultsScene]
  };
}
