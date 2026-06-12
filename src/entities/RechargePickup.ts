import Phaser from "phaser";
import { Palette } from "../game/constants";

export type RechargePickupType = "shield" | "ammo" | "health" | "combo";

export type RechargePickupConfig = {
  x: number;
  y: number;
  type: RechargePickupType;
  shieldAmount: number;
  ammoAmount: number;
  healthAmount: number;
};

const RECHARGE_STYLE: Record<RechargePickupType, { label: string; color: number; textColor: string }> = {
  shield: {
    label: "Shield",
    color: 0x38bdf8,
    textColor: "#bae6fd"
  },
  ammo: {
    label: "Ammo",
    color: 0x86efac,
    textColor: "#bbf7d0"
  },
  health: {
    label: "Health",
    color: 0xfb7185,
    textColor: "#fecdd3"
  },
  combo: {
    label: "Supply",
    color: 0xfacc15,
    textColor: "#fef08a"
  }
};

export class RechargePickup {
  private readonly container: Phaser.GameObjects.Container;
  private readonly highlight: Phaser.GameObjects.Arc;
  private readonly glow: Phaser.GameObjects.Arc;
  private readonly body: Phaser.GameObjects.Arc;
  private readonly label: Phaser.GameObjects.Text;
  readonly type: RechargePickupType;
  readonly shieldAmount: number;
  readonly ammoAmount: number;
  readonly healthAmount: number;
  readonly pickupRadius = 44;
  private collected = false;

  constructor(scene: Phaser.Scene, config: RechargePickupConfig) {
    this.type = config.type;
    this.shieldAmount = config.shieldAmount;
    this.ammoAmount = config.ammoAmount;
    this.healthAmount = config.healthAmount;

    const style = RECHARGE_STYLE[config.type];
    const shadow = scene.add.ellipse(0, 9, 42, 16, 0x000000, 0.22);
    this.glow = scene.add.circle(0, 0, 38, style.color, 0.15).setBlendMode(Phaser.BlendModes.ADD);
    this.highlight = scene.add.circle(0, 0, this.pickupRadius, 0xffffff, 0).setStrokeStyle(2, Palette.accent, 0);
    const outerRing = scene.add.circle(0, 0, 25, 0xffffff, 0).setStrokeStyle(2, style.color, 0.6);
    this.body = scene.add.circle(0, 0, 17, style.color, 1).setStrokeStyle(2, 0x0f172a, 1);
    const crossHorizontal = scene.add.rectangle(0, 0, 22, 5, 0x0f172a, 0.75);
    const crossVertical = scene.add.rectangle(0, 0, 5, 22, 0x0f172a, 0.75);
    this.label = scene.add
      .text(0, -32, this.getLabelText(style.label), {
        color: style.textColor,
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
        fontStyle: "800",
        stroke: "#0b1020",
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.container = scene.add.container(config.x, config.y, [
      shadow,
      this.glow,
      this.highlight,
      outerRing,
      this.body,
      crossHorizontal,
      crossVertical,
      this.label
    ]);
    this.container.setDepth(4);

    scene.tweens.add({
      targets: this.container,
      y: config.y - 5,
      duration: 900 + Phaser.Math.Between(0, 260),
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    });
    scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.08, to: 0.24 },
      scale: { from: 0.88, to: 1.2 },
      duration: 780,
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
    this.container.scene.tweens.killTweensOf(this.glow);
    this.container.destroy();
  }

  getPromptText(): string {
    const parts: string[] = [];

    if (this.shieldAmount > 0) {
      parts.push(`shield +${this.shieldAmount}`);
    }

    if (this.healthAmount > 0) {
      parts.push(`health +${this.healthAmount}`);
    }

    if (this.ammoAmount > 0) {
      parts.push(`ammo +${this.ammoAmount}`);
    }

    return `Press E: ${parts.join(" / ")}`;
  }

  get x(): number {
    return this.container.x;
  }

  get y(): number {
    return this.container.y;
  }

  private getLabelText(label: string): string {
    const values: string[] = [];

    if (this.shieldAmount > 0) {
      values.push(`S+${this.shieldAmount}`);
    }

    if (this.healthAmount > 0) {
      values.push(`H+${this.healthAmount}`);
    }

    if (this.ammoAmount > 0) {
      values.push(`A+${this.ammoAmount}`);
    }

    return `${label} ${values.join(" ")}`;
  }
}
