import Phaser from "phaser";
import { Palette } from "../game/constants";

export type LootDropType = "armor" | "coins";

export type LootDropConfig = {
  x: number;
  y: number;
  type: LootDropType;
  amount: number;
};

const LOOT_STYLE: Record<LootDropType, { label: string; color: number; textColor: string }> = {
  armor: {
    label: "Armor",
    color: 0x67e8f9,
    textColor: "#bae6fd"
  },
  coins: {
    label: "Coins",
    color: 0xfacc15,
    textColor: "#fef08a"
  }
};

export class LootDrop {
  private readonly container: Phaser.GameObjects.Container;
  private readonly highlight: Phaser.GameObjects.Arc;
  private readonly glow: Phaser.GameObjects.Arc;
  private readonly body: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  readonly type: LootDropType;
  readonly amount: number;
  readonly pickupRadius = 42;
  private collected = false;

  constructor(scene: Phaser.Scene, config: LootDropConfig) {
    this.type = config.type;
    this.amount = config.amount;

    const style = LOOT_STYLE[config.type];
    const shadow = scene.add.ellipse(0, 8, 34, 14, 0x000000, 0.22);
    this.glow = scene.add.circle(0, 0, 34, style.color, 0.16).setBlendMode(Phaser.BlendModes.ADD);
    this.highlight = scene.add.circle(0, 0, this.pickupRadius, 0xffffff, 0).setStrokeStyle(2, Palette.accent, 0);
    this.body = scene.add.rectangle(0, 0, 22, 22, style.color, 1).setAngle(45).setStrokeStyle(2, 0x0f172a, 1);
    const glint = scene.add.circle(-5, -5, 4, 0xffffff, 0.55);
    this.label = scene.add
      .text(0, -28, `${style.label} +${config.amount}`, {
        color: style.textColor,
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
        fontStyle: "800",
        stroke: "#0b1020",
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.container = scene.add.container(config.x, config.y, [shadow, this.glow, this.highlight, this.body, glint, this.label]);
    this.container.setDepth(4);

    scene.tweens.add({
      targets: this.container,
      y: config.y - 4,
      duration: 820 + Phaser.Math.Between(0, 220),
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    });
    scene.tweens.add({
      targets: this.body,
      angle: 405,
      duration: 2600,
      repeat: -1
    });
    scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.08, to: 0.22 },
      scale: { from: 0.88, to: 1.18 },
      duration: 760,
      yoyo: true,
      repeat: -1
    });
  }

  setInRange(inRange: boolean): void {
    if (this.collected) {
      return;
    }

    this.highlight.setStrokeStyle(2, Palette.accent, inRange ? 0.85 : 0);
    this.label.setAlpha(inRange ? 1 : 0);
    this.label.setScale(inRange ? 1.08 : 1);
  }

  isInRange(x: number, y: number): boolean {
    if (this.collected) {
      return false;
    }

    return Phaser.Math.Distance.Between(this.x, this.y, x, y) <= this.pickupRadius;
  }

  collect(): void {
    this.collected = true;
    this.container.scene.tweens.killTweensOf(this.container);
    this.container.scene.tweens.killTweensOf(this.body);
    this.container.scene.tweens.killTweensOf(this.glow);
    this.container.destroy();
  }

  get x(): number {
    return this.container.x;
  }

  get y(): number {
    return this.container.y;
  }
}
