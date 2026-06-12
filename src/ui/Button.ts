import Phaser from "phaser";
import { Palette } from "../game/constants";
import { sfxSystem } from "../systems/SfxSystem";

type ButtonIcon = "play" | "help" | "settings" | "upgrade" | "replay" | "menu";

type ButtonConfig = {
  label: string;
  icon?: ButtonIcon;
  x: number;
  y: number;
  width: number;
  height: number;
  disabled?: boolean;
  onClick: () => void;
};

export function createTextButton(scene: Phaser.Scene, config: ButtonConfig): Phaser.GameObjects.Container {
  const fillTopColor = config.disabled ? Palette.panelLight : 0x203454;
  const fillBottomColor = config.disabled ? Palette.panel : 0x111d33;
  const hoverTopColor = config.disabled ? Palette.panelLight : 0x284268;
  const hoverBottomColor = config.disabled ? Palette.panel : 0x162641;
  const textColor = config.disabled ? Palette.mutedText : Palette.text;
  const radius = Math.min(8, Math.max(5, Math.round(config.height * 0.14)));
  const fontSize = `${Math.min(20, Math.max(15, Math.round(config.height * 0.38)))}px`;
  const textResolution = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const iconSize = Math.min(30, Math.max(22, Math.round(config.height * 0.62)));
  const labelX = config.icon ? iconSize * 0.72 : 0;

  const glow = scene.add.graphics();
  const background = scene.add.graphics();
  const icon = config.icon ? createButtonIcon(scene, config.icon, iconSize, config.disabled ?? false) : undefined;

  icon?.setPosition(-config.width / 2 + 34, 0);

  const drawButton = (hovered: boolean): void => {
    const topColor = hovered ? hoverTopColor : fillTopColor;
    const bottomColor = hovered ? hoverBottomColor : fillBottomColor;

    glow.clear();
    background.clear();

    if (!config.disabled) {
      glow.fillStyle(0x67e8f9, hovered ? 0.16 : 0.08);
      glow.fillRoundedRect(-config.width / 2 - 4, -config.height / 2 - 3, config.width + 8, config.height + 6, radius);
      glow.lineStyle(2, Palette.accent, hovered ? 0.65 : 0.36);
      glow.lineBetween(-config.width / 2 + 18, config.height / 2 + 3, config.width / 2 - 18, config.height / 2 + 3);
    }

    background.fillStyle(0x000000, config.disabled ? 0.18 : 0.32);
    background.fillRoundedRect(-config.width / 2 + 4, -config.height / 2 + 5, config.width, config.height, radius);
    background.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1, 1, 1, 1);
    background.fillRoundedRect(-config.width / 2, -config.height / 2, config.width, config.height, radius);
    background.fillStyle(0x67e8f9, config.disabled ? 0.08 : 0.16);
    background.fillTriangle(
      -config.width / 2 + 10,
      0,
      -config.width / 2 + 32,
      -config.height / 2 + 8,
      -config.width / 2 + 32,
      config.height / 2 - 8
    );
    background.fillTriangle(
      config.width / 2 - 10,
      0,
      config.width / 2 - 32,
      -config.height / 2 + 8,
      config.width / 2 - 32,
      config.height / 2 - 8
    );
    background.fillStyle(Palette.accent, config.disabled ? 0.14 : hovered ? 0.82 : 0.56);
    background.fillRect(-config.width / 2 + 14, -2, 14, 4);
    background.fillRect(config.width / 2 - 28, -2, 14, 4);
    background.lineStyle(2, config.disabled ? 0x475569 : 0xbfffee, hovered ? 1 : 0.82);
    background.strokeRoundedRect(-config.width / 2, -config.height / 2, config.width, config.height, radius);
    background.lineStyle(2, 0x7dd3fc, config.disabled ? 0.12 : 0.42);
    background.lineBetween(-config.width / 2 + 20, -config.height / 2 + 7, config.width / 2 - 20, -config.height / 2 + 7);
    background.lineStyle(2, 0x0f172a, config.disabled ? 0.22 : 0.76);
    background.lineBetween(-config.width / 2 + 16, config.height / 2 - 7, config.width / 2 - 16, config.height / 2 - 7);
  };

  drawButton(false);

  const label = scene.add
    .text(labelX, 0, config.label, {
      color: textColor,
      fontFamily: "Arial, sans-serif",
      fontSize,
      fontStyle: "800",
      strokeThickness: 0
    })
    .setOrigin(0.5)
    .setResolution(textResolution);

  const hitArea = scene.add.rectangle(0, 0, config.width, config.height, 0xffffff, 0.001).setOrigin(0.5);
  const children: Phaser.GameObjects.GameObject[] = [glow, background];

  if (icon) {
    children.push(icon);
  }

  children.push(label, hitArea);

  const button = scene.add.container(config.x, config.y, children);

  if (!config.disabled) {
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on("pointerover", () => {
      drawButton(true);
    });
    hitArea.on("pointerout", () => {
      drawButton(false);
      button.y = config.y;
    });
    hitArea.on("pointerdown", () => {
      button.y = config.y + 1;
    });
    hitArea.on("pointerup", () => {
      button.y = config.y;
      drawButton(false);
      sfxSystem.play("ui");
      config.onClick();
    });
    hitArea.on("pointerupoutside", () => {
      button.y = config.y;
      drawButton(false);
    });
  }

  return button;
}

function createButtonIcon(scene: Phaser.Scene, icon: ButtonIcon, size: number, disabled: boolean): Phaser.GameObjects.Container {
  const accent = disabled ? 0x94a3b8 : Palette.accent;
  const softAccent = disabled ? 0x475569 : 0x7dd3fc;
  const graphics = scene.add.graphics();
  const container = scene.add.container(0, 0, [graphics]);
  const half = size / 2;

  graphics.fillStyle(0x0f172a, disabled ? 0.6 : 0.92);
  graphics.fillRoundedRect(-half, -half, size, size, 6);
  graphics.lineStyle(2, softAccent, disabled ? 0.32 : 0.82);
  graphics.strokeRoundedRect(-half, -half, size, size, 6);
  graphics.fillStyle(accent, disabled ? 0.24 : 0.95);
  graphics.lineStyle(3, accent, disabled ? 0.28 : 0.95);

  switch (icon) {
    case "play":
      graphics.beginPath();
      graphics.moveTo(-5, -9);
      graphics.lineTo(10, 0);
      graphics.lineTo(-5, 9);
      graphics.closePath();
      graphics.fillPath();
      break;
    case "help": {
      const text = scene.add
        .text(0, -1, "?", {
          color: Phaser.Display.Color.IntegerToColor(accent).rgba,
          fontFamily: "Arial, sans-serif",
          fontSize: `${Math.round(size * 0.72)}px`,
          fontStyle: "900"
        })
        .setOrigin(0.5)
        .setResolution(Math.min(2, Math.max(1, window.devicePixelRatio || 1)));
      container.add(text);
      break;
    }
    case "settings":
      for (let spoke = 0; spoke < 8; spoke += 1) {
        const angle = (spoke / 8) * Math.PI * 2;
        graphics.lineBetween(Math.cos(angle) * 7, Math.sin(angle) * 7, Math.cos(angle) * 11, Math.sin(angle) * 11);
      }
      graphics.strokeCircle(0, 0, 8);
      graphics.fillCircle(0, 0, 3.5);
      break;
    case "upgrade":
      graphics.beginPath();
      graphics.moveTo(0, -11);
      graphics.lineTo(11, 1);
      graphics.lineTo(5, 1);
      graphics.lineTo(5, 11);
      graphics.lineTo(-5, 11);
      graphics.lineTo(-5, 1);
      graphics.lineTo(-11, 1);
      graphics.closePath();
      graphics.fillPath();
      break;
    case "replay":
      graphics.strokeCircle(0, 1, 9);
      graphics.beginPath();
      graphics.moveTo(9, -7);
      graphics.lineTo(13, -1);
      graphics.lineTo(6, 0);
      graphics.closePath();
      graphics.fillPath();
      break;
    case "menu":
      graphics.lineBetween(-10, -7, 10, -7);
      graphics.lineBetween(-10, 0, 10, 0);
      graphics.lineBetween(-10, 7, 10, 7);
      break;
  }

  return container;
}
