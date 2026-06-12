import Phaser from "phaser";
import { getUpgradeCost, UPGRADE_DEFINITIONS, type UpgradeDefinition } from "../data/upgrades";
import { GAME_HEIGHT, GAME_WIDTH, Palette, SceneKeys } from "../game/constants";
import { saveSystem } from "../systems/SaveSystem";
import { createTextButton } from "../ui/Button";

export class UpgradeScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Upgrades);
  }

  create(): void {
    this.render();
  }

  private render(): void {
    this.children.removeAll();
    this.cameras.main.setBackgroundColor(Palette.background);

    const progress = saveSystem.loadProgress();

    this.add
      .text(GAME_WIDTH / 2, 52, "Upgrades", {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "42px",
        fontStyle: "800"
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 92, `Coins: ${progress.coins}`, {
        color: Palette.mutedText,
        fontFamily: "Arial, sans-serif",
        fontSize: "20px"
      })
      .setOrigin(0.5);

    UPGRADE_DEFINITIONS.forEach((upgrade, index) => {
      this.addUpgradeRow(upgrade, 116 + index * 102);
    });

    createTextButton(this, {
      label: "Back",
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 56,
      width: 220,
      height: 50,
      onClick: () => this.scene.start(SceneKeys.Menu)
    });
  }

  private addUpgradeRow(upgrade: UpgradeDefinition, y: number): void {
    const progress = saveSystem.loadProgress();
    const currentLevel = progress.upgrades[upgrade.id];
    const cost = getUpgradeCost(upgrade, currentLevel);
    const canAfford = progress.coins >= cost;
    const graphics = this.add.graphics();

    graphics.fillStyle(Palette.panel, 1);
    graphics.fillRoundedRect(96, y, GAME_WIDTH - 192, 82, 8);
    graphics.lineStyle(2, Palette.panelLight, 1);
    graphics.strokeRoundedRect(96, y, GAME_WIDTH - 192, 82, 8);

    this.add.text(126, y + 15, upgrade.name, {
      color: Palette.text,
      fontFamily: "Arial, sans-serif",
      fontSize: "22px",
      fontStyle: "700"
    });

    this.add.text(126, y + 48, upgrade.description, {
      color: Palette.mutedText,
      fontFamily: "Arial, sans-serif",
      fontSize: "16px"
    });

    this.add
      .text(588, y + 27, `Level ${currentLevel}`, {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        fontStyle: "700"
      })
      .setOrigin(0.5);

    createTextButton(this, {
      label: `${cost} Coins`,
      x: 762,
      y: y + 41,
      width: 190,
      height: 46,
      disabled: !canAfford,
      onClick: () => this.buyUpgrade(upgrade)
    });
  }

  private buyUpgrade(upgrade: UpgradeDefinition): void {
    const progress = saveSystem.loadProgress();
    const currentLevel = progress.upgrades[upgrade.id];
    const cost = getUpgradeCost(upgrade, currentLevel);

    if (progress.coins < cost) {
      return;
    }

    saveSystem.saveProgress({
      ...progress,
      coins: progress.coins - cost,
      upgrades: {
        ...progress.upgrades,
        [upgrade.id]: currentLevel + 1
      }
    });

    this.render();
  }
}
