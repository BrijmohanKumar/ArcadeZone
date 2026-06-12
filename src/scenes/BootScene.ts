import Phaser from "phaser";
import { Palette, SceneKeys } from "../game/constants";
import { playablesBridge } from "../platform/PlayablesBridge";
import { saveSystem } from "../systems/SaveSystem";

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(Palette.background);
    playablesBridge.firstFrameReady();

    void saveSystem.hydrateFromPlatform().finally(() => {
      this.scene.start(SceneKeys.Menu);
    });
  }
}
