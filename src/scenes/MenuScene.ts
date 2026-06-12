import Phaser from "phaser";
import { getTankSkin } from "../data/tankSkins";
import { GAME_HEIGHT, GAME_WIDTH, Palette, SceneKeys } from "../game/constants";
import { tryEnterLandscapeMode } from "../platform/OrientationLock";
import { playablesBridge } from "../platform/PlayablesBridge";
import { saveSystem } from "../systems/SaveSystem";
import { sfxSystem } from "../systems/SfxSystem";
import { createTextButton } from "../ui/Button";

export class MenuScene extends Phaser.Scene {
  private namePrompt?: Phaser.GameObjects.Container;
  private nameInputElement?: HTMLInputElement;
  private pendingPlayerName = "";
  private readonly handleNameInput = (): void => this.updatePendingNameFromInput();
  private readonly handleNameInputKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Enter") {
      this.confirmPlayerName();
      event.preventDefault();
    }

    if (event.key === "Escape") {
      this.closeNamePrompt();
      event.preventDefault();
    }
  };
  private readonly handleViewportChanged = (): void => this.positionNameInputElement();

  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    sfxSystem.registerScene(this);
    this.cameras.main.setBackgroundColor(Palette.background);

    this.drawHeroBackground();
    this.drawTitleBlock();
    this.drawPreviewArena();
    this.drawActionButtons();

    playablesBridge.gameReady();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.closeNamePrompt();
    });
  }

  private drawHeroBackground(): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(0x070b14, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    graphics.lineStyle(1, 0x23304d, 0.32);
    for (let x = -GAME_HEIGHT; x < GAME_WIDTH; x += 36) {
      graphics.lineBetween(x, 0, x + GAME_HEIGHT, GAME_HEIGHT);
    }

    graphics.lineStyle(1, 0x15213a, 0.75);
    for (let y = 34; y < GAME_HEIGHT; y += 34) {
      graphics.lineBetween(0, y, GAME_WIDTH, y);
    }

    graphics.fillStyle(0x101a2f, 0.9);
    graphics.fillRoundedRect(24, 16, GAME_WIDTH - 48, GAME_HEIGHT - 30, 16);
    graphics.lineStyle(2, 0x2d426a, 0.8);
    graphics.strokeRoundedRect(24, 16, GAME_WIDTH - 48, GAME_HEIGHT - 30, 16);

    graphics.lineStyle(3, Palette.accent, 0.65);
    graphics.lineBetween(88, 42, 310, 42);
    graphics.lineStyle(3, Palette.warning, 0.65);
    graphics.lineBetween(GAME_WIDTH - 310, GAME_HEIGHT - 42, GAME_WIDTH - 88, GAME_HEIGHT - 42);

    this.add.circle(126, 448, 104, 0x28d39b, 0.08).setBlendMode(Phaser.BlendModes.ADD);
    this.add.circle(808, 108, 142, 0xef4444, 0.07).setBlendMode(Phaser.BlendModes.ADD);
    this.add.circle(756, 430, 90, 0xf59e0b, 0.07).setBlendMode(Phaser.BlendModes.ADD);
  }

  private drawTitleBlock(): void {
    const titleShadow = this.add
      .text(GAME_WIDTH / 2 + 3, 61, "Arena Zone", {
        color: "#0f172a",
        fontFamily: "Arial, sans-serif",
        fontSize: "58px",
        fontStyle: "800"
      })
      .setOrigin(0.5)
      .setAlpha(0.7);

    this.add
      .text(GAME_WIDTH / 2, 58, "Arena Zone", {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "58px",
        fontStyle: "800"
      })
      .setOrigin(0.5)
      .setShadow(0, 0, "#67e8f9", 10, true, true);

    this.add
      .text(GAME_WIDTH / 2, 105, "Loot fast. Fight smart. Survive the Zone.", {
        color: Palette.mutedText,
        fontFamily: "Arial, sans-serif",
        fontSize: "20px"
      })
      .setOrigin(0.5);

    const accent = this.add.graphics();
    accent.lineStyle(2, Palette.accent, 1);
    accent.lineBetween(GAME_WIDTH / 2 - 126, 86, GAME_WIDTH / 2 + 126, 86);
    accent.lineStyle(2, Palette.warning, 1);
    accent.lineBetween(GAME_WIDTH / 2 - 52, 116, GAME_WIDTH / 2 + 52, 116);

    this.tweens.add({
      targets: titleShadow,
      alpha: { from: 0.45, to: 0.8 },
      duration: 1400,
      yoyo: true,
      repeat: -1
    });
  }

  private drawActionButtons(): void {
    createTextButton(this, {
      label: "Play",
      icon: "play",
      x: GAME_WIDTH / 2,
      y: 432,
      width: 210,
      height: 44,
      onClick: () => this.handlePlayClick()
    });

    createTextButton(this, {
      label: "How To Play",
      icon: "help",
      x: GAME_WIDTH / 2 - 220,
      y: 500,
      width: 170,
      height: 38,
      onClick: () => this.scene.start(SceneKeys.HowToPlay)
    });

    createTextButton(this, {
      label: "Settings",
      icon: "settings",
      x: GAME_WIDTH / 2,
      y: 500,
      width: 170,
      height: 38,
      onClick: () => this.scene.start(SceneKeys.Settings)
    });

    createTextButton(this, {
      label: "Upgrades",
      icon: "upgrade",
      x: GAME_WIDTH / 2 + 220,
      y: 500,
      width: 170,
      height: 38,
      onClick: () => this.scene.start(SceneKeys.Upgrades)
    });
  }

  private handlePlayClick(): void {
    void tryEnterLandscapeMode();

    const progress = saveSystem.loadProgress();

    if (progress.playerName.trim()) {
      this.scene.start(SceneKeys.Lobby);
      return;
    }

    this.openNamePrompt();
  }

  private openNamePrompt(): void {
    if (this.namePrompt) {
      return;
    }

    this.pendingPlayerName = "";
    const shade = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020617, 0.62);
    const panel = this.add.graphics();

    panel.fillStyle(0x101a2f, 0.98);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 240, GAME_HEIGHT / 2 - 132, 480, 264, 14);
    panel.lineStyle(3, Palette.accent, 0.9);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 240, GAME_HEIGHT / 2 - 132, 480, 264, 14);
    panel.lineStyle(2, Palette.warning, 0.72);
    panel.lineBetween(GAME_WIDTH / 2 - 142, GAME_HEIGHT / 2 + 30, GAME_WIDTH / 2 + 142, GAME_HEIGHT / 2 + 30);

    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 84, "Enter Player Name", {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "32px",
        fontStyle: "900"
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 42, "This will be remembered for future matches.", {
        color: Palette.mutedText,
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        fontStyle: "700"
      })
      .setOrigin(0.5);

    const inputBack = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 8, 330, 48, 0x0f172a, 1)
      .setStrokeStyle(2, 0x7dd3fc, 0.75);

    const saveButton = createTextButton(this, {
      label: "Save",
      x: GAME_WIDTH / 2 - 92,
      y: GAME_HEIGHT / 2 + 84,
      width: 150,
      height: 44,
      onClick: () => this.confirmPlayerName()
    });

    const backButton = createTextButton(this, {
      label: "Back",
      x: GAME_WIDTH / 2 + 92,
      y: GAME_HEIGHT / 2 + 84,
      width: 150,
      height: 44,
      onClick: () => this.closeNamePrompt()
    });

    this.namePrompt = this.add.container(0, 0, [shade, panel, title, hint, inputBack, saveButton, backButton]);
    this.namePrompt.setDepth(90);
    this.createNameInputElement();

    sfxSystem.play("ui");
  }

  private createNameInputElement(): void {
    const input = document.createElement("input");

    input.className = "player-name-input";
    input.type = "text";
    input.inputMode = "text";
    input.autocomplete = "name";
    input.autocapitalize = "words";
    input.maxLength = 14;
    input.placeholder = "Type your name";
    input.value = this.pendingPlayerName;

    input.addEventListener("input", this.handleNameInput);
    input.addEventListener("keydown", this.handleNameInputKeyDown);
    window.addEventListener("resize", this.handleViewportChanged);
    window.addEventListener("orientationchange", this.handleViewportChanged);
    document.body.appendChild(input);

    this.nameInputElement = input;
    this.positionNameInputElement();
    input.focus({ preventScroll: true });
  }

  private positionNameInputElement(): void {
    const input = this.nameInputElement;

    if (!input) {
      return;
    }

    const canvasBounds = this.game.canvas.getBoundingClientRect();
    const scaleX = canvasBounds.width / GAME_WIDTH;
    const scaleY = canvasBounds.height / GAME_HEIGHT;
    const inputWidth = 330 * scaleX;
    const inputHeight = 48 * scaleY;
    const inputX = GAME_WIDTH / 2 - 165;
    const inputY = GAME_HEIGHT / 2 + 8 - 24;

    input.style.left = `${canvasBounds.left + inputX * scaleX}px`;
    input.style.top = `${canvasBounds.top + inputY * scaleY}px`;
    input.style.width = `${inputWidth}px`;
    input.style.height = `${inputHeight}px`;
    input.style.fontSize = `${Math.max(16, 24 * Math.min(scaleX, scaleY))}px`;
  }

  private updatePendingNameFromInput(): void {
    const input = this.nameInputElement;

    if (!input) {
      return;
    }

    const cleanedValue = input.value.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").slice(0, 14);

    if (input.value !== cleanedValue) {
      input.value = cleanedValue;
    }

    this.pendingPlayerName = cleanedValue;
  }

  private confirmPlayerName(): void {
    this.updatePendingNameFromInput();
    const cleanName = this.sanitizePlayerName(this.pendingPlayerName);

    if (!cleanName) {
      this.pendingPlayerName = "Player";
      if (this.nameInputElement) {
        this.nameInputElement.value = this.pendingPlayerName;
        this.nameInputElement.focus({ preventScroll: true });
      }
      return;
    }

    saveSystem.updatePlayerName(cleanName);
    this.closeNamePrompt();
    sfxSystem.play("start");
    this.scene.start(SceneKeys.Lobby);
  }

  private closeNamePrompt(): void {
    this.destroyNameInputElement();
    this.namePrompt?.destroy(true);
    this.namePrompt = undefined;
    this.pendingPlayerName = "";
  }

  private destroyNameInputElement(): void {
    if (!this.nameInputElement) {
      return;
    }

    this.nameInputElement.removeEventListener("input", this.handleNameInput);
    this.nameInputElement.removeEventListener("keydown", this.handleNameInputKeyDown);
    window.removeEventListener("resize", this.handleViewportChanged);
    window.removeEventListener("orientationchange", this.handleViewportChanged);
    this.nameInputElement.remove();
    this.nameInputElement = undefined;
  }

  private sanitizePlayerName(playerName: string): string {
    return playerName.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 14);
  }

  private drawPreviewArena(): void {
    const graphics = this.add.graphics();
    const centerX = GAME_WIDTH / 2;
    const centerY = 268;
    const arenaWidth = 800;
    const arenaHeight = 240;
    const arenaX = centerX - arenaWidth / 2;
    const arenaY = centerY - arenaHeight / 2;

    graphics.fillStyle(0x0d1324, 1);
    graphics.fillRoundedRect(arenaX - 16, arenaY - 18, arenaWidth + 32, arenaHeight + 36, 18);
    graphics.lineStyle(3, 0x33466f, 0.92);
    graphics.strokeRoundedRect(arenaX - 16, arenaY - 18, arenaWidth + 32, arenaHeight + 36, 18);

    graphics.fillStyle(Palette.arena, 1);
    graphics.fillRoundedRect(arenaX, arenaY, arenaWidth, arenaHeight, 12);
    graphics.lineStyle(2, Palette.arenaLine, 0.9);
    graphics.strokeRoundedRect(arenaX, arenaY, arenaWidth, arenaHeight, 12);

    graphics.lineStyle(1, 0x3b527b, 0.52);
    for (let x = arenaX + 48; x < arenaX + arenaWidth; x += 64) {
      graphics.lineBetween(x, arenaY + 12, x, arenaY + arenaHeight - 12);
    }
    for (let y = arenaY + 42; y < arenaY + arenaHeight; y += 48) {
      graphics.lineBetween(arenaX + 12, y, arenaX + arenaWidth - 12, y);
    }

    graphics.fillStyle(0x111827, 0.72);
    graphics.fillRoundedRect(arenaX + 26, arenaY + 22, 126, 52, 7);
    graphics.fillRoundedRect(arenaX + arenaWidth - 158, arenaY + arenaHeight - 78, 132, 54, 7);
    graphics.fillRoundedRect(centerX - 48, arenaY + arenaHeight - 50, 96, 30, 6);

    const safeRing = this.add
      .circle(centerX + 34, centerY - 8, 92)
      .setStrokeStyle(4, 0x7dd3fc, 0.85)
      .setFillStyle(0x7dd3fc, 0.045)
      .setBlendMode(Phaser.BlendModes.ADD);
    const dangerRing = this.add
      .circle(centerX + 34, centerY - 8, 128)
      .setStrokeStyle(3, Palette.danger, 0.4)
      .setBlendMode(Phaser.BlendModes.ADD);
    const innerRing = this.add
      .circle(centerX + 34, centerY - 8, 42)
      .setStrokeStyle(2, Palette.accent, 0.9)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.createZoneSweep(centerX + 34, centerY - 8, 90);
    this.createSignalBeacon(centerX + 34, centerY - 8, 0x7dd3fc, 0);
    this.createSignalBeacon(arenaX + 92, arenaY + 52, Palette.accent, 260);
    this.createSignalBeacon(arenaX + arenaWidth - 94, arenaY + arenaHeight - 52, Palette.warning, 520);

    this.tweens.add({
      targets: [safeRing, innerRing],
      scale: { from: 0.98, to: 1.05 },
      alpha: { from: 0.72, to: 1 },
      duration: 1350,
      yoyo: true,
      repeat: -1
    });
    this.tweens.add({
      targets: dangerRing,
      scale: { from: 1.03, to: 0.96 },
      alpha: { from: 0.35, to: 0.68 },
      duration: 1700,
      yoyo: true,
      repeat: -1
    });

    this.drawLootDiamond(graphics, centerX - 12, centerY + 48, 0xfacc15);
    this.drawLootDiamond(graphics, centerX + 128, centerY + 58, Palette.accent);
    this.drawLootDiamond(graphics, centerX - 218, centerY - 44, 0xa78bfa);
    this.createLootPulse(centerX - 12, centerY + 48, 0xfacc15, 160);
    this.createLootPulse(centerX + 128, centerY + 58, Palette.accent, 420);
    this.createLootPulse(centerX - 218, centerY - 44, 0xa78bfa, 680);

    const selectedSkin = getTankSkin(saveSystem.loadProgress().tankSkin);
    const player = this.drawPreviewTank(centerX - 150, centerY + 14, selectedSkin.primary, -0.12, -0.18);
    const rivalA = this.drawPreviewTank(centerX + 154, centerY - 42, Palette.danger, 2.9, 2.95);
    const rivalB = this.drawPreviewTank(centerX + 244, centerY + 54, Palette.warning, -2.4, -2.86);
    const rivalC = this.drawPreviewTank(centerX - 24, centerY - 86, 0xa78bfa, 1.2, 1.92);

    this.createPreviewProjectile(centerX - 126, centerY + 5, centerX + 122, centerY - 36, Palette.aim, 0);
    this.createPreviewProjectile(centerX + 142, centerY - 28, centerX - 116, centerY + 12, Palette.danger, 520);
    this.createPreviewProjectile(centerX + 222, centerY + 42, centerX + 70, centerY + 4, Palette.warning, 1040);

    this.add
      .text(arenaX + 24, arenaY + 15, "SURVIVE THE ZONE", {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        fontStyle: "800"
      })
      .setShadow(0, 0, "#28d39b", 5, true, true);

    this.tweens.add({
      targets: player,
      x: player.x + 18,
      y: player.y - 6,
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    this.tweens.add({
      targets: rivalA,
      x: rivalA.x - 14,
      y: rivalA.y + 10,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    this.tweens.add({
      targets: rivalB,
      x: rivalB.x - 18,
      y: rivalB.y - 8,
      duration: 1700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    this.tweens.add({
      targets: rivalC,
      x: rivalC.x + 12,
      y: rivalC.y + 16,
      duration: 1450,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

  }

  private createZoneSweep(x: number, y: number, radius: number): void {
    const sweep = this.add.container(x, y).setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
    const beam = this.add.rectangle(radius / 2, 0, radius, 4, 0x7dd3fc, 0.18).setOrigin(0.5);
    const tip = this.add.circle(radius, 0, 5, 0xb7f7ff, 0.8);
    const hub = this.add.circle(0, 0, 5, Palette.accent, 0.72);

    sweep.add([beam, tip, hub]);
    this.tweens.add({
      targets: sweep,
      rotation: Math.PI * 2,
      duration: 3200,
      repeat: -1,
      ease: "Linear"
    });
    this.tweens.add({
      targets: beam,
      alpha: { from: 0.08, to: 0.26 },
      duration: 720,
      yoyo: true,
      repeat: -1
    });
  }

  private createSignalBeacon(x: number, y: number, color: number, delay: number): void {
    const ringA = this.add.circle(x, y, 12, 0xffffff, 0).setStrokeStyle(2, color, 0.54).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
    const ringB = this.add.circle(x, y, 20, 0xffffff, 0).setStrokeStyle(2, color, 0.28).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
    const dot = this.add.circle(x, y, 4, color, 0.9).setDepth(6);

    [ringA, ringB].forEach((ring, index) => {
      this.tweens.add({
        targets: ring,
        alpha: { from: index === 0 ? 0.7 : 0.36, to: 0 },
        scale: { from: 0.65, to: 1.9 },
        duration: 1050,
        delay: delay + index * 220,
        repeatDelay: 360,
        repeat: -1
      });
    });
    this.tweens.add({
      targets: dot,
      alpha: { from: 0.58, to: 1 },
      scale: { from: 0.86, to: 1.28 },
      duration: 520,
      delay,
      yoyo: true,
      repeat: -1
    });
  }

  private createLootPulse(x: number, y: number, color: number, delay: number): void {
    const pulse = this.add.circle(x, y, 16, 0xffffff, 0).setStrokeStyle(2, color, 0.42).setDepth(4).setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: pulse,
      alpha: { from: 0.5, to: 0 },
      scale: { from: 0.72, to: 1.8 },
      duration: 980,
      delay,
      repeat: -1
    });
  }

  private drawPreviewTank(
    x: number,
    y: number,
    fillColor: number,
    chassisAngle: number,
    turretAngle: number
  ): Phaser.GameObjects.Container {
    const shadow = this.add.ellipse(2, 8, 44, 18, 0x000000, 0.28);
    const glow = this.add.ellipse(0, 0, 52, 38, fillColor, 0.12).setBlendMode(Phaser.BlendModes.ADD);
    const leftTrack = this.add.rectangle(0, -12, 40, 8, 0x111827, 1).setStrokeStyle(1, 0x64748b, 0.86);
    const rightTrack = this.add.rectangle(0, 12, 40, 8, 0x111827, 1).setStrokeStyle(1, 0x64748b, 0.86);
    const hull = this.add.rectangle(0, 0, 31, 23, fillColor, 1).setStrokeStyle(2, 0xe2e8f0, 0.55);
    const frontPlate = this.add.rectangle(12, 0, 8, 17, 0x0f172a, 0.32);
    const treadA = this.add.rectangle(-13, -12, 5, 6, 0x94a3b8, 0.48);
    const treadB = this.add.rectangle(1, -12, 5, 6, 0x94a3b8, 0.48);
    const treadC = this.add.rectangle(14, 12, 5, 6, 0x94a3b8, 0.48);
    const treadD = this.add.rectangle(-1, 12, 5, 6, 0x94a3b8, 0.48);
    const chassis = this.add.container(0, 0, [leftTrack, rightTrack, treadA, treadB, treadC, treadD, hull, frontPlate]);
    chassis.rotation = chassisAngle;

    const barrel = this.add.rectangle(10, 0, 34, 6, 0xf8fafc, 1).setOrigin(0, 0.5);
    const turret = this.add.rectangle(0, 0, 22, 16, 0xdbeafe, 1).setStrokeStyle(2, 0x0f172a, 1);
    const turretAccent = this.add.rectangle(-5, 0, 8, 10, 0x0f172a, 0.26);
    const turretGroup = this.add.container(0, 0, [barrel, turret, turretAccent]);
    turretGroup.rotation = turretAngle;

    const tank = this.add.container(x, y, [shadow, glow, chassis, turretGroup]);
    tank.setDepth(6);

    this.tweens.add({
      targets: turretGroup,
      rotation: turretAngle + 0.22,
      duration: 1050,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    this.tweens.add({
      targets: [treadA, treadB, treadC, treadD],
      alpha: { from: 0.32, to: 0.72 },
      duration: 260,
      yoyo: true,
      repeat: -1
    });

    return tank;
  }

  private drawLootDiamond(graphics: Phaser.GameObjects.Graphics, x: number, y: number, color: number): void {
    graphics.fillStyle(color, 0.95);
    graphics.beginPath();
    graphics.moveTo(x, y - 11);
    graphics.lineTo(x + 12, y);
    graphics.lineTo(x, y + 11);
    graphics.lineTo(x - 12, y);
    graphics.closePath();
    graphics.fillPath();

    graphics.lineStyle(2, 0xffffff, 0.36);
    graphics.strokePath();
  }

  private createPreviewProjectile(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: number,
    delay: number
  ): void {
    const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
    const distance = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
    const projectile = this.add
      .container(fromX, fromY, [
        this.add.rectangle(-9, 0, 18, 3, color, 0.4).setOrigin(1, 0.5),
        this.add.circle(0, 0, 4, color, 1).setStrokeStyle(1, 0xffffff, 0.6)
      ])
      .setDepth(8)
      .setRotation(angle)
      .setVisible(false);
    const muzzleFlash = this.add
      .container(fromX, fromY, [
        this.add.circle(0, 0, 8, color, 0.28).setBlendMode(Phaser.BlendModes.ADD),
        this.add.rectangle(7, 0, 22, 4, color, 0.35).setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD)
      ])
      .setDepth(7)
      .setRotation(angle)
      .setVisible(false);
    const impactFlash = this.add.circle(toX, toY, 6, color, 0.2).setDepth(7).setVisible(false);
    const travelMs = Phaser.Math.Clamp(distance * 1.65, 360, 520);

    const fire = (): void => {
      projectile.setPosition(fromX, fromY);
      projectile.setAlpha(1);
      projectile.setScale(1);
      projectile.setVisible(true);

      muzzleFlash.setPosition(fromX, fromY);
      muzzleFlash.setAlpha(1);
      muzzleFlash.setScale(0.75);
      muzzleFlash.setVisible(true);

      this.tweens.add({
        targets: muzzleFlash,
        alpha: 0,
        scale: 1.8,
        duration: 120,
        ease: "Quad.easeOut",
        onComplete: () => muzzleFlash.setVisible(false)
      });
      this.tweens.add({
        targets: projectile,
        x: toX,
        y: toY,
        duration: travelMs,
        ease: "Linear",
        onComplete: () => {
          projectile.setVisible(false);
          impactFlash.setPosition(toX, toY);
          impactFlash.setScale(0.8);
          impactFlash.setAlpha(0.24);
          impactFlash.setVisible(true);
          this.tweens.add({
            targets: impactFlash,
            alpha: 0,
            scale: 1.8,
            duration: 140,
            onComplete: () => impactFlash.setVisible(false)
          });
        }
      });
    };

    this.time.delayedCall(delay, () => {
      fire();
      this.time.addEvent({
        delay: 1450,
        callback: fire,
        loop: true
      });
    });
  }
}
