import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, Palette, SceneKeys } from "../game/constants";
import { createTextButton } from "../ui/Button";

const CONTROL_LINES = ["Move tank: WASD / arrows", "Aim turret: mouse", "Fire: Space or left click", "Collect: E near supplies"];
const MATCH_LINES = ["Blue circle is safe", "Rivals fight everyone", "Loot weapons and support", "Coins buy upgrades"];
const FLOW_LINES = ["Drop In", "Loot Fast", "Stay In Zone", "Last Tank Wins"];

export class HowToPlayScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.HowToPlay);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(Palette.background);
    this.drawBackground();
    this.addTitle();
    this.addRulePanel();
    this.addPreview();
    this.addFlowStrip();

    createTextButton(this, {
      label: "Back",
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 42,
      width: 220,
      height: 46,
      onClick: () => this.scene.start(SceneKeys.Menu)
    });
  }

  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x050816, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.lineStyle(1, 0x1f2a44, 0.38);

    for (let x = -GAME_HEIGHT; x < GAME_WIDTH; x += 42) {
      graphics.lineBetween(x, 0, x + GAME_HEIGHT, GAME_HEIGHT);
    }

    graphics.lineStyle(1, 0x13213b, 0.66);
    for (let y = 34; y < GAME_HEIGHT; y += 34) {
      graphics.lineBetween(0, y, GAME_WIDTH, y);
    }

    graphics.fillStyle(0x101a2f, 0.72);
    graphics.fillRoundedRect(20, 18, GAME_WIDTH - 40, GAME_HEIGHT - 34, 16);
    graphics.lineStyle(2, 0x2d426a, 0.62);
    graphics.strokeRoundedRect(20, 18, GAME_WIDTH - 40, GAME_HEIGHT - 34, 16);

    graphics.lineStyle(3, Palette.accent, 0.7);
    graphics.lineBetween(82, 42, 284, 42);
    graphics.lineStyle(3, Palette.warning, 0.66);
    graphics.lineBetween(GAME_WIDTH - 282, GAME_HEIGHT - 42, GAME_WIDTH - 82, GAME_HEIGHT - 42);

    const lowerGlow = this.add.circle(142, 430, 126, 0x28d39b, 0.07).setBlendMode(Phaser.BlendModes.ADD);
    const dangerGlow = this.add.circle(812, 140, 154, 0xef4444, 0.075).setBlendMode(Phaser.BlendModes.ADD);
    const warningGlow = this.add.circle(742, 430, 98, 0xf59e0b, 0.055).setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: [lowerGlow, dangerGlow, warningGlow],
      alpha: { from: 0.045, to: 0.105 },
      scale: { from: 0.94, to: 1.08 },
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  private addTitle(): void {
    this.add
      .text(GAME_WIDTH / 2, 54, "How To Play", {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "42px",
        fontStyle: "900"
      })
      .setOrigin(0.5)
      .setShadow(0, 0, "#67e8f9", 8, true, true);

    this.add
      .text(GAME_WIDTH / 2, 92, "Drive, aim, loot, and survive the shrinking arena.", {
        color: Palette.mutedText,
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        fontStyle: "700"
      })
      .setOrigin(0.5);
  }

  private addRulePanel(): void {
    const left = 38;
    const top = 128;
    const width = 438;
    const height = 280;
    const graphics = this.add.graphics();

    graphics.fillStyle(Palette.panel, 0.96);
    graphics.fillRoundedRect(left, top, width, height, 10);
    graphics.lineStyle(2, Palette.panelLight, 1);
    graphics.strokeRoundedRect(left, top, width, height, 10);
    graphics.lineStyle(2, Palette.accent, 0.34);
    graphics.lineBetween(left + 26, top + 18, left + width - 26, top + 18);
    graphics.fillStyle(0x0f172a, 0.48);
    graphics.fillRoundedRect(left + 20, top + 38, width - 40, 112, 8);
    graphics.fillRoundedRect(left + 20, top + 156, width - 40, 108, 8);

    this.addSection(left + 34, top + 48, "Controls", CONTROL_LINES, Palette.accent);
    this.addSection(left + 34, top + 166, "Match", MATCH_LINES, Palette.warning);
  }

  private addSection(x: number, y: number, title: string, lines: string[], color: number): void {
    this.add.text(x, y, title, {
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      fontFamily: "Arial, sans-serif",
      fontSize: "18px",
      fontStyle: "900"
    });

    lines.forEach((line, index) => {
      const rowY = y + 26 + index * 18;
      this.drawMiniIcon(x + 8, rowY + 7, color, index);
      this.add.text(x + 24, rowY, line, {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        fontStyle: "700"
      });
    });
  }

  private addPreview(): void {
    const left = 512;
    const top = 128;
    const width = 410;
    const height = 262;
    const graphics = this.add.graphics();
    const centerX = left + width / 2;
    const centerY = top + height / 2 - 4;

    graphics.fillStyle(Palette.panel, 0.96);
    graphics.fillRoundedRect(left, top, width, height, 10);
    graphics.lineStyle(2, Palette.panelLight, 1);
    graphics.strokeRoundedRect(left, top, width, height, 10);

    graphics.fillStyle(Palette.arena, 1);
    graphics.fillRoundedRect(left + 22, top + 22, width - 44, height - 44, 8);
    graphics.lineStyle(1, Palette.arenaLine, 0.55);

    for (let x = left + 52; x < left + width - 38; x += 42) {
      graphics.lineBetween(x, top + 28, x, top + height - 28);
    }

    for (let y = top + 52; y < top + height - 34; y += 42) {
      graphics.lineBetween(left + 28, y, left + width - 28, y);
    }

    const safeRing = this.add
      .circle(centerX, centerY, 80, 0x38bdf8, 0.07)
      .setStrokeStyle(4, 0x7dd3fc, 0.92)
      .setBlendMode(Phaser.BlendModes.ADD);
    const dangerRing = this.add
      .circle(centerX, centerY, 116, 0xef4444, 0)
      .setStrokeStyle(4, Palette.danger, 0.74)
      .setBlendMode(Phaser.BlendModes.ADD);
    const innerRing = this.add
      .circle(centerX, centerY, 36, 0x28d39b, 0.035)
      .setStrokeStyle(2, Palette.accent, 0.9)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: [safeRing, innerRing],
      scale: { from: 0.98, to: 1.06 },
      alpha: { from: 0.72, to: 1 },
      duration: 1250,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    this.tweens.add({
      targets: dangerRing,
      scale: { from: 1.04, to: 0.96 },
      alpha: { from: 0.45, to: 0.85 },
      duration: 1650,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    const player = this.drawTank(centerX - 54, centerY + 24, Palette.player, -0.55, -1.2);
    const rival = this.drawTank(centerX + 72, centerY - 34, Palette.danger, 2.4, 2.9);
    const supply = this.drawSupply(centerX + 24, centerY + 76, Palette.warning);
    this.drawSupply(centerX - 108, centerY - 58, 0xa78bfa);
    this.createPreviewProjectile(centerX - 34, centerY + 2, centerX + 48, centerY - 24, Palette.aim, 0);
    this.createPreviewProjectile(centerX + 50, centerY - 22, centerX - 38, centerY + 10, Palette.danger, 560);

    this.tweens.add({
      targets: player,
      x: player.x + 18,
      y: player.y - 8,
      duration: 1350,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    this.tweens.add({
      targets: rival,
      x: rival.x - 18,
      y: rival.y + 10,
      duration: 1550,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    this.tweens.add({
      targets: supply,
      y: supply.y - 8,
      alpha: { from: 0.78, to: 1 },
      duration: 760,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    this.add
      .text(centerX, top + height - 28, "Live Arena Drill", {
        color: Palette.mutedText,
        fontFamily: "Arial, sans-serif",
        fontSize: "15px",
        fontStyle: "800"
      })
      .setOrigin(0.5);
  }

  private drawTank(x: number, y: number, color: number, chassisAngle: number, turretAngle: number): Phaser.GameObjects.Container {
    const shadow = this.add.ellipse(0, 8, 44, 18, 0x000000, 0.26);
    const glow = this.add.ellipse(0, 0, 58, 42, color, 0.12).setBlendMode(Phaser.BlendModes.ADD);
    const leftTrack = this.add.rectangle(0, -13, 42, 8, 0x111827, 1).setStrokeStyle(1, 0x64748b, 0.8);
    const rightTrack = this.add.rectangle(0, 13, 42, 8, 0x111827, 1).setStrokeStyle(1, 0x64748b, 0.8);
    const hull = this.add.rectangle(0, 0, 32, 24, color, 1).setStrokeStyle(2, 0xe2e8f0, 0.55);
    const treadA = this.add.rectangle(-13, -13, 5, 6, 0x94a3b8, 0.48);
    const treadB = this.add.rectangle(3, -13, 5, 6, 0x94a3b8, 0.48);
    const treadC = this.add.rectangle(13, 13, 5, 6, 0x94a3b8, 0.48);
    const treadD = this.add.rectangle(-3, 13, 5, 6, 0x94a3b8, 0.48);
    const chassis = this.add.container(0, 0, [leftTrack, rightTrack, treadA, treadB, treadC, treadD, hull]);
    chassis.rotation = chassisAngle;

    const barrel = this.add.rectangle(10, 0, 34, 6, 0xf8fafc, 1).setOrigin(0, 0.5);
    const turret = this.add.rectangle(0, 0, 22, 16, 0xdbeafe, 1).setStrokeStyle(2, 0x0f172a, 1);
    const turretGroup = this.add.container(0, 0, [barrel, turret]);
    turretGroup.rotation = turretAngle;

    const tank = this.add.container(x, y, [shadow, glow, chassis, turretGroup]).setDepth(4);

    this.tweens.add({
      targets: turretGroup,
      rotation: turretAngle + 0.24,
      duration: 920,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    this.tweens.add({
      targets: [treadA, treadB, treadC, treadD],
      alpha: { from: 0.3, to: 0.82 },
      duration: 280,
      yoyo: true,
      repeat: -1
    });

    return tank;
  }

  private drawSupply(x: number, y: number, color: number): Phaser.GameObjects.Container {
    const glow = this.add.circle(0, 0, 24, color, 0.16).setBlendMode(Phaser.BlendModes.ADD);
    const body = this.add.circle(0, 0, 16, color, 1).setStrokeStyle(2, 0x0f172a, 1);
    const horizontal = this.add.rectangle(0, 0, 20, 5, 0x0f172a, 0.78);
    const vertical = this.add.rectangle(0, 0, 5, 20, 0x0f172a, 0.78);
    return this.add.container(x, y, [glow, body, horizontal, vertical]).setDepth(4);
  }

  private addFlowStrip(): void {
    const graphics = this.add.graphics();
    const left = 74;
    const top = 418;
    const width = GAME_WIDTH - 148;
    const segmentWidth = width / FLOW_LINES.length;

    graphics.fillStyle(0x0f172a, 0.7);
    graphics.fillRoundedRect(left, top, width, 34, 8);
    graphics.lineStyle(2, 0x33466f, 0.7);
    graphics.strokeRoundedRect(left, top, width, 34, 8);

    FLOW_LINES.forEach((line, index) => {
      const x = left + segmentWidth * index;
      const centerX = x + segmentWidth / 2;
      const color = index === 0 || index === 3 ? Palette.accent : index === 1 ? Palette.warning : 0x7dd3fc;

      if (index > 0) {
        graphics.lineStyle(1, 0x33466f, 0.65);
        graphics.lineBetween(x, top + 8, x, top + 26);
      }

      this.add.circle(centerX - 58, top + 17, 5, color, 1);
      this.add.text(centerX - 42, top + 7, line, {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        fontStyle: "800"
      });
    });
  }

  private drawMiniIcon(x: number, y: number, color: number, index: number): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(color, 1);
    if (index === 0) {
      graphics.fillTriangle(x - 6, y + 5, x, y - 6, x + 6, y + 5);
    } else if (index === 1) {
      graphics.lineStyle(3, color, 1);
      graphics.strokeCircle(x, y, 6);
      graphics.lineBetween(x + 5, y + 5, x + 10, y + 10);
    } else if (index === 2) {
      graphics.fillRoundedRect(x - 8, y - 3, 16, 6, 3);
    } else {
      graphics.fillCircle(x, y, 6);
      graphics.fillStyle(0x0f172a, 0.76);
      graphics.fillRect(x - 5, y - 1, 10, 2);
      graphics.fillRect(x - 1, y - 5, 2, 10);
    }
  }

  private createPreviewProjectile(fromX: number, fromY: number, toX: number, toY: number, color: number, delay: number): void {
    const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
    const projectile = this.add
      .container(fromX, fromY, [
        this.add.rectangle(-8, 0, 16, 3, color, 0.38).setOrigin(1, 0.5),
        this.add.circle(0, 0, 4, color, 1).setStrokeStyle(1, 0xffffff, 0.56)
      ])
      .setRotation(angle)
      .setDepth(6)
      .setVisible(false);
    const flash = this.add.circle(fromX, fromY, 7, color, 0.26).setDepth(5).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);

    const fire = (): void => {
      projectile.setPosition(fromX, fromY).setAlpha(1).setVisible(true);
      flash.setPosition(fromX, fromY).setScale(0.8).setAlpha(0.32).setVisible(true);

      this.tweens.add({
        targets: flash,
        alpha: 0,
        scale: 1.8,
        duration: 120,
        onComplete: () => flash.setVisible(false)
      });
      this.tweens.add({
        targets: projectile,
        x: toX,
        y: toY,
        duration: 460,
        ease: "Linear",
        onComplete: () => projectile.setVisible(false)
      });
    };

    this.time.delayedCall(delay, () => {
      fire();
      this.time.addEvent({
        delay: 1250,
        callback: fire,
        loop: true
      });
    });
  }
}
