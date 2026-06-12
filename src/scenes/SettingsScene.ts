import Phaser from "phaser";
import { DEFAULT_TANK_SKIN_ID, getTankSkin, TANK_SKINS, type TankSkinDefinition, type TankSkinId } from "../data/tankSkins";
import { GAME_HEIGHT, GAME_WIDTH, Palette, SceneKeys } from "../game/constants";
import { saveSystem } from "../systems/SaveSystem";
import { sfxSystem } from "../systems/SfxSystem";
import { createTextButton } from "../ui/Button";

export class SettingsScene extends Phaser.Scene {
  private readonly skinCards: Phaser.GameObjects.Container[] = [];
  private pendingPlayerName = "";
  private selectedSkinId: TankSkinId = DEFAULT_TANK_SKIN_ID;
  private nameInputBack?: Phaser.GameObjects.Rectangle;
  private nameInputElement?: HTMLInputElement;
  private statusText?: Phaser.GameObjects.Text;
  private skinTitle?: Phaser.GameObjects.Text;
  private soundButton?: Phaser.GameObjects.Container;
  private readonly handleNameInput = (): void => this.updatePendingNameFromInput();
  private readonly handleNameInputKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Enter") {
      this.savePlayerName();
      event.preventDefault();
    }

    if (event.key === "Escape") {
      this.nameInputElement?.blur();
      event.preventDefault();
    }
  };
  private readonly handleViewportChanged = (): void => this.positionNameInputElement();

  constructor() {
    super(SceneKeys.Settings);
  }

  create(): void {
    const progress = saveSystem.loadProgress();

    this.pendingPlayerName = progress.playerName.trim() || "Player";
    this.selectedSkinId = getTankSkin(progress.tankSkin).id;
    this.skinCards.length = 0;

    sfxSystem.registerScene(this);
    this.cameras.main.setBackgroundColor(Palette.background);
    this.drawBackground();
    this.drawHeader();
    this.drawSettingsPanel();
    this.drawNameSection();
    this.drawSoundToggle();
    this.drawSkinCards();
    this.drawFooterButtons();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.destroyNameInputElement();
    });
  }

  private drawBackground(): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(0x070b14, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.lineStyle(1, 0x23304d, 0.32);

    for (let x = -GAME_HEIGHT; x < GAME_WIDTH; x += 40) {
      graphics.lineBetween(x, 0, x + GAME_HEIGHT, GAME_HEIGHT);
    }

    graphics.fillStyle(0x101a2f, 0.9);
    graphics.fillRoundedRect(28, 18, GAME_WIDTH - 56, GAME_HEIGHT - 36, 16);
    graphics.lineStyle(2, 0x2d426a, 0.85);
    graphics.strokeRoundedRect(28, 18, GAME_WIDTH - 56, GAME_HEIGHT - 36, 16);
    graphics.lineStyle(3, Palette.accent, 0.72);
    graphics.lineBetween(86, 44, 292, 44);
    graphics.lineStyle(3, Palette.warning, 0.72);
    graphics.lineBetween(GAME_WIDTH - 292, GAME_HEIGHT - 44, GAME_WIDTH - 86, GAME_HEIGHT - 44);

    this.add.circle(170, 438, 108, Palette.accent, 0.08).setBlendMode(Phaser.BlendModes.ADD);
    this.add.circle(782, 130, 132, Palette.danger, 0.06).setBlendMode(Phaser.BlendModes.ADD);
  }

  private drawHeader(): void {
    this.add
      .text(GAME_WIDTH / 2, 68, "Settings", {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "48px",
        fontStyle: "900"
      })
      .setOrigin(0.5)
      .setShadow(0, 0, "#67e8f9", 8, true, true);

    this.add
      .text(GAME_WIDTH / 2, 108, "Pilot name, sound, and tank skin", {
        color: Palette.mutedText,
        fontFamily: "Arial, sans-serif",
        fontSize: "17px",
        fontStyle: "700"
      })
      .setOrigin(0.5);
  }

  private drawSettingsPanel(): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(Palette.panel, 0.96);
    graphics.fillRoundedRect(64, 132, GAME_WIDTH - 128, 306, 12);
    graphics.lineStyle(2, Palette.panelLight, 1);
    graphics.strokeRoundedRect(64, 132, GAME_WIDTH - 128, 306, 12);
  }

  private drawNameSection(): void {
    this.add
      .text(104, 156, "Player Name", {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "21px",
        fontStyle: "900"
      })
      .setOrigin(0, 0.5);

    this.nameInputBack = this.add.rectangle(278, 194, 330, 44, 0x0f172a, 1).setStrokeStyle(2, 0x7dd3fc, 0.7);
    this.nameInputBack.setInteractive({ useHandCursor: true });
    this.nameInputBack.on("pointerup", () => this.nameInputElement?.focus({ preventScroll: true }));

    createTextButton(this, {
      label: "Save Name",
      x: 526,
      y: 194,
      width: 150,
      height: 40,
      onClick: () => this.savePlayerName()
    });

    this.statusText = this.add
      .text(104, 226, "", {
        color: Palette.mutedText,
        fontFamily: "Arial, sans-serif",
        fontSize: "15px",
        fontStyle: "800"
      })
      .setOrigin(0, 0.5);

    this.createNameInputElement();
  }

  private drawSoundToggle(): void {
    this.soundButton?.destroy(true);
    this.soundButton = createTextButton(this, {
      label: sfxSystem.isMuted ? "Sound: Muted" : "Sound: On",
      x: 760,
      y: 194,
      width: 166,
      height: 40,
      onClick: () => {
        this.nameInputElement?.blur();
        sfxSystem.toggleMuted();
        this.drawSoundToggle();
      }
    });
  }

  private drawSkinCards(): void {
    this.skinCards.forEach((card) => card.destroy(true));
    this.skinCards.length = 0;

    if (!this.skinTitle) {
      this.skinTitle = this.add
        .text(104, 252, "Tank Skin", {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "21px",
        fontStyle: "900"
      })
        .setOrigin(0, 0.5);
    }

    TANK_SKINS.forEach((skin, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = 110 + column * 252;
      const y = 278 + row * 86;
      this.skinCards.push(this.createSkinCard(skin, x, y));
    });
  }

  private createSkinCard(skin: TankSkinDefinition, x: number, y: number): Phaser.GameObjects.Container {
    const selected = skin.id === this.selectedSkinId;
    const background = this.add.graphics();
    const fillColor = selected ? 0x203454 : 0x111827;
    const borderColor = selected ? skin.accent : Palette.panelLight;

    background.fillStyle(fillColor, 0.98);
    background.fillRoundedRect(0, 0, 220, 66, 8);
    background.lineStyle(selected ? 3 : 2, borderColor, selected ? 1 : 0.72);
    background.strokeRoundedRect(0, 0, 220, 66, 8);
    background.fillStyle(skin.primary, 0.18);
    background.fillRoundedRect(10, 10, 62, 46, 7);

    const tank = this.createMiniTank(42, 34, skin);
    const label = this.add
      .text(86, 24, skin.name, {
        color: selected ? Palette.text : Palette.mutedText,
        fontFamily: "Arial, sans-serif",
        fontSize: "17px",
        fontStyle: "900"
      })
      .setOrigin(0, 0.5);
    const marker = this.add
      .text(86, 45, selected ? "Selected" : "Tap To Select", {
        color: selected ? "#bbf7d0" : Palette.mutedText,
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
        fontStyle: "800"
      })
      .setOrigin(0, 0.5);
    const hitArea = this.add.rectangle(110, 33, 220, 66, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    const card = this.add.container(x, y, [background, tank, label, marker, hitArea]);

    hitArea.on("pointerup", () => {
      this.nameInputElement?.blur();
      this.selectedSkinId = skin.id;
      saveSystem.updateTankSkin(skin.id);
      sfxSystem.play("switch");
      this.showStatus(`${skin.name} selected.`);
      this.drawSkinCards();
    });

    return card;
  }

  private createMiniTank(x: number, y: number, skin: TankSkinDefinition): Phaser.GameObjects.Container {
    const shadow = this.add.ellipse(0, 7, 38, 14, 0x000000, 0.25);
    const leftTrack = this.add.rectangle(0, -11, 36, 7, skin.track, 1).setStrokeStyle(1, 0x64748b, 0.8);
    const rightTrack = this.add.rectangle(0, 11, 36, 7, skin.track, 1).setStrokeStyle(1, 0x64748b, 0.8);
    const hull = this.add.rectangle(0, 0, 28, 21, skin.primary, 1).setStrokeStyle(2, skin.barrel, 0.85);
    const front = this.add.rectangle(10, 0, 7, 15, skin.dark, 0.65);
    const barrel = this.add.rectangle(9, 0, 30, 5, skin.barrel, 1).setOrigin(0, 0.5);
    const turret = this.add.rectangle(0, 0, 18, 14, skin.turret, 1).setStrokeStyle(2, 0x0f172a, 1);
    const turretAccent = this.add.rectangle(-4, 0, 7, 9, skin.dark, 0.5);
    const turretGroup = this.add.container(0, 0, [barrel, turret, turretAccent]).setRotation(-0.12);
    const tank = this.add.container(x, y, [shadow, leftTrack, rightTrack, hull, front, turretGroup]);

    tank.setRotation(-0.08);
    return tank;
  }

  private drawFooterButtons(): void {
    createTextButton(this, {
      label: "Back",
      x: GAME_WIDTH / 2,
      y: 478,
      width: 190,
      height: 42,
      onClick: () => {
        this.savePlayerName();
        this.scene.start(SceneKeys.Menu);
      }
    });
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
    input.value = this.pendingPlayerName.trim() || "Player";

    input.addEventListener("input", this.handleNameInput);
    input.addEventListener("keydown", this.handleNameInputKeyDown);
    window.addEventListener("resize", this.handleViewportChanged);
    window.addEventListener("orientationchange", this.handleViewportChanged);
    document.body.appendChild(input);

    this.nameInputElement = input;
    this.positionNameInputElement();
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
    const inputHeight = 44 * scaleY;
    const inputX = 278 - 330 / 2;
    const inputY = 194 - 44 / 2;

    input.style.left = `${canvasBounds.left + inputX * scaleX}px`;
    input.style.top = `${canvasBounds.top + inputY * scaleY}px`;
    input.style.width = `${inputWidth}px`;
    input.style.height = `${inputHeight}px`;
    input.style.fontSize = `${Math.max(16, 22 * Math.min(scaleX, scaleY))}px`;
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

  private updateNameInputText(): void {
    if (this.nameInputElement) {
      this.nameInputElement.value = this.pendingPlayerName.trim() || "Player";
    }
  }

  private savePlayerName(): void {
    this.updatePendingNameFromInput();
    const cleanName = this.sanitizePlayerName(this.pendingPlayerName) || "Player";
    this.pendingPlayerName = cleanName;
    saveSystem.updatePlayerName(cleanName);
    this.updateNameInputText();
    this.showStatus("Name saved.");
    sfxSystem.play("pickup");
  }

  private showStatus(message: string): void {
    this.statusText?.setText(message);
    this.time.delayedCall(1200, () => {
      this.statusText?.setText("");
    });
  }

  private sanitizePlayerName(playerName: string): string {
    return playerName.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 14);
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
}
