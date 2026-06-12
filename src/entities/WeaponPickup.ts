import Phaser from "phaser";
import type { WeaponDefinition } from "../data/weapons";
import { Palette } from "../game/constants";

export type WeaponPickupConfig = {
  x: number;
  y: number;
  weapon: WeaponDefinition;
  ammo: number;
};

export class WeaponPickup {
  private readonly container: Phaser.GameObjects.Container;
  private readonly highlight: Phaser.GameObjects.Arc;
  private readonly glow: Phaser.GameObjects.Arc;
  private readonly label: Phaser.GameObjects.Text;
  readonly weapon: WeaponDefinition;
  readonly ammo: number;
  readonly pickupRadius = 48;
  private collected = false;

  constructor(scene: Phaser.Scene, config: WeaponPickupConfig) {
    this.weapon = config.weapon;
    this.ammo = config.ammo;

    const shadow = scene.add.ellipse(0, 9, 54, 18, 0x000000, 0.22);
    this.glow = scene.add.circle(0, 0, 44, this.weapon.bulletColor, 0.13).setBlendMode(Phaser.BlendModes.ADD);
    this.highlight = scene.add.circle(0, 0, this.pickupRadius, 0xffffff, 0).setStrokeStyle(2, Palette.accent, 0);
    const rarityRing = scene.add.circle(0, 0, 31, 0xffffff, 0).setStrokeStyle(2, this.weapon.bulletColor, 0.62);
    const body = scene.add.rectangle(0, 0, 58, 22, this.weapon.bulletColor, 1).setStrokeStyle(2, 0x0f172a, 1);
    const barrel = scene.add.rectangle(30, 0, 24, 6, 0xe2e8f0, 1).setOrigin(0, 0.5);
    const shine = scene.add.rectangle(-14, -6, 18, 4, 0xffffff, 0.36).setAngle(-12);
    this.label = scene.add
      .text(0, -34, this.weapon.name, {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        fontStyle: "800",
        stroke: "#0b1020",
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setAlpha(0.58);

    this.container = scene.add.container(config.x, config.y, [shadow, this.glow, this.highlight, rarityRing, body, barrel, shine, this.label]);
    this.container.setDepth(4);

    scene.tweens.add({
      targets: this.container,
      y: config.y - 5,
      duration: 950 + Phaser.Math.Between(0, 240),
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    });
    scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.08, to: 0.2 },
      scale: { from: 0.9, to: 1.18 },
      duration: 820,
      yoyo: true,
      repeat: -1
    });
    scene.tweens.add({
      targets: this.label,
      alpha: { from: 0.46, to: 1 },
      scale: { from: 0.96, to: 1.08 },
      duration: 560,
      yoyo: true,
      repeat: -1
    });
  }

  setInRange(inRange: boolean): void {
    if (this.collected) {
      return;
    }

    this.highlight.setStrokeStyle(2, Palette.accent, inRange ? 0.85 : 0);
    this.label.setColor(inRange ? "#bbf7d0" : Palette.text);
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
    this.container.scene.tweens.killTweensOf(this.glow);
    this.container.scene.tweens.killTweensOf(this.label);
    this.container.destroy();
  }

  get isCollected(): boolean {
    return this.collected;
  }

  get x(): number {
    return this.container.x;
  }

  get y(): number {
    return this.container.y;
  }
}
