import Phaser from "phaser";
import { GAME_WIDTH, Palette } from "../game/constants";

export type TutorialStepId = "move" | "shoot" | "pickup" | "switch" | "zone" | "complete";

type TutorialStepConfig = {
  id: TutorialStepId;
  title: string;
  body: string;
  progress: string;
};

const PANEL_WIDTH = 462;
const PANEL_HEIGHT = 96;

export class TutorialGuide {
  private readonly container: Phaser.GameObjects.Container;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly progressText: Phaser.GameObjects.Text;
  private readonly accentBar: Phaser.GameObjects.Rectangle;
  private currentStep?: TutorialStepId;
  private dismissed = false;

  constructor(scene: Phaser.Scene, onSkip: () => void) {
    const x = GAME_WIDTH / 2;
    const y = 152;
    const panel = scene.add
      .rectangle(0, 0, PANEL_WIDTH, PANEL_HEIGHT, Palette.panel, 0.94)
      .setStrokeStyle(2, Palette.panelLight, 1)
      .setOrigin(0.5);
    this.accentBar = scene.add.rectangle(-PANEL_WIDTH / 2 + 4, 0, 8, PANEL_HEIGHT - 12, Palette.accent, 1).setOrigin(0.5);
    this.titleText = scene.add
      .text(-204, -30, "", {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        fontStyle: "900"
      })
      .setOrigin(0, 0.5);
    this.bodyText = scene.add
      .text(-204, 5, "", {
        color: Palette.mutedText,
        fontFamily: "Arial, sans-serif",
        fontSize: "15px",
        fontStyle: "700",
        wordWrap: { width: 350 }
      })
      .setOrigin(0, 0.5);
    this.progressText = scene.add
      .text(168, 28, "", {
        color: "#fef3c7",
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        fontStyle: "800"
      })
      .setOrigin(0.5);

    const skipBackground = scene.add
      .rectangle(184, -30, 62, 26, Palette.panelLight, 0.9)
      .setStrokeStyle(1, Palette.arenaLine, 1)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const skipText = scene.add
      .text(184, -30, "Skip", {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
        fontStyle: "800"
      })
      .setOrigin(0.5);

    skipBackground.on("pointerover", () => skipBackground.setFillStyle(Palette.arenaLine, 1));
    skipBackground.on("pointerout", () => skipBackground.setFillStyle(Palette.panelLight, 0.9));
    skipBackground.on("pointerdown", () => {
      this.dismissed = true;
      onSkip();
    });

    this.container = scene.add
      .container(x, y, [panel, this.accentBar, this.titleText, this.bodyText, this.progressText, skipBackground, skipText])
      .setDepth(60)
      .setAlpha(0);
  }

  get isDismissed(): boolean {
    return this.dismissed;
  }

  showStep(step: TutorialStepConfig): void {
    if (this.dismissed) {
      return;
    }

    const changedStep = this.currentStep !== step.id;
    this.currentStep = step.id;
    this.titleText.setText(step.title);
    this.bodyText.setText(step.body);
    this.progressText.setText(step.progress);

    if (changedStep) {
      this.container.scene.tweens.killTweensOf(this.container);
      this.container.setScale(0.97);
      this.container.scene.tweens.add({
        targets: this.container,
        alpha: 1,
        scale: 1,
        duration: 180,
        ease: "Quad.easeOut"
      });
      this.container.scene.tweens.add({
        targets: this.accentBar,
        alpha: { from: 0.45, to: 1 },
        yoyo: true,
        duration: 180
      });
    } else if (this.container.alpha < 1) {
      this.container.setAlpha(1);
    }
  }

  hide(): void {
    this.container.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 180
    });
  }
}
