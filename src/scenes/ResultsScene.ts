import Phaser from "phaser";
import { DEFAULT_MATCH_RESULT, type MatchResultData, type MatchStanding } from "../data/matchResults";
import { GAME_HEIGHT, GAME_WIDTH, Palette, SceneKeys } from "../game/constants";
import { sfxSystem } from "../systems/SfxSystem";
import { createTextButton } from "../ui/Button";

export class ResultsScene extends Phaser.Scene {
  private result: MatchResultData = DEFAULT_MATCH_RESULT;

  constructor() {
    super(SceneKeys.Results);
  }

  init(data: Partial<MatchResultData>): void {
    this.result = {
      ...DEFAULT_MATCH_RESULT,
      ...data
    };
  }

  create(): void {
    sfxSystem.registerScene(this);
    this.cameras.main.setBackgroundColor(Palette.background);
    this.drawResultPanel();
    this.drawActions();
    sfxSystem.play(this.result.won ? "victory" : "defeat");
  }

  private drawResultPanel(): void {
    const title = this.result.won ? "Victory" : "Eliminated";
    const titleColor = this.result.won ? "#bbf7d0" : "#fecaca";
    const standings = this.getStandings();
    const graphics = this.add.graphics();

    graphics.fillStyle(Palette.panel, 1);
    graphics.fillRoundedRect(82, 92, GAME_WIDTH - 164, 310, 8);
    graphics.lineStyle(2, this.result.won ? Palette.accent : Palette.danger, 1);
    graphics.strokeRoundedRect(82, 92, GAME_WIDTH - 164, 310, 8);

    this.add
      .text(GAME_WIDTH / 2, 62, title, {
        color: titleColor,
        fontFamily: "Arial, sans-serif",
        fontSize: "48px",
        fontStyle: "800"
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 116, `Rank #${this.result.placement} of ${this.result.playerCount}   Score ${this.result.score}   Coins +${this.result.coinsEarned}`, {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "23px",
        fontStyle: "800"
      })
      .setOrigin(0.5);

    this.drawTableHeader(standings);
    this.drawStandingsRows(standings);
  }

  private drawTableHeader(standings: MatchStanding[]): void {
    const headerY = 150;
    const graphics = this.add.graphics();

    graphics.fillStyle(0x0f172a, 0.76);
    graphics.fillRoundedRect(112, headerY - 10, GAME_WIDTH - 224, 34, 6);

    this.add.text(134, headerY, "RANK", {
      color: Palette.mutedText,
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "800"
    });
    this.add.text(240, headerY, "PLAYER", {
      color: Palette.mutedText,
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "800"
    });
    this.add
      .text(652, headerY, "SCORE", {
        color: Palette.mutedText,
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        fontStyle: "800"
      })
      .setOrigin(1, 0);
    this.add
      .text(792, headerY, "COINS", {
        color: Palette.mutedText,
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        fontStyle: "800"
      })
      .setOrigin(1, 0);

  }

  private drawStandingsRows(standings: MatchStanding[]): void {
    const rowStartY = 184;
    const rowGap = 26;

    standings.slice(0, 8).forEach((standing, index) => {
      const y = rowStartY + index * rowGap;
      const graphics = this.add.graphics();
      const rowColor = standing.isPlayer ? 0x17324f : index % 2 === 0 ? 0x111827 : 0x0f172a;
      const borderColor = standing.isPlayer ? Palette.accent : 0x334155;

      graphics.fillStyle(rowColor, standing.isPlayer ? 0.95 : 0.72);
      graphics.fillRoundedRect(112, y - 8, GAME_WIDTH - 224, 24, 6);
      graphics.lineStyle(standing.isPlayer ? 2 : 1, borderColor, standing.isPlayer ? 0.9 : 0.38);
      graphics.strokeRoundedRect(112, y - 8, GAME_WIDTH - 224, 24, 6);

      this.add.text(134, y - 1, `#${standing.position}`, {
        color: standing.position === 1 ? "#fef3c7" : Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "15px",
        fontStyle: "900"
      });

      this.add.text(240, y - 1, standing.name, {
        color: standing.isPlayer ? "#dffcff" : Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "15px",
        fontStyle: "800"
      });

      this.add
        .text(652, y - 1, `${standing.score}`, {
          color: Palette.text,
          fontFamily: "Arial, sans-serif",
          fontSize: "15px",
          fontStyle: "800"
        })
        .setOrigin(1, 0);

      this.add
        .text(792, y - 1, `+${standing.coinsEarned}`, {
          color: "#fef3c7",
          fontFamily: "Arial, sans-serif",
          fontSize: "15px",
          fontStyle: "800"
        })
        .setOrigin(1, 0);
    });
  }

  private getStandings(): MatchStanding[] {
    if (this.result.standings.length > 0) {
      return this.result.standings;
    }

    return [
      {
        position: this.result.placement,
        name: "You",
        score: this.result.score,
        coinsEarned: this.result.coinsEarned,
        eliminated: !this.result.won,
        isPlayer: true
      }
    ];
  }

  private drawActions(): void {
    createTextButton(this, {
      label: "Play Again",
      icon: "replay",
      x: GAME_WIDTH / 2 - 240,
      y: GAME_HEIGHT - 92,
      width: 210,
      height: 54,
      onClick: () => this.scene.start(SceneKeys.Lobby)
    });

    createTextButton(this, {
      label: "Upgrades",
      icon: "upgrade",
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 92,
      width: 210,
      height: 54,
      onClick: () => this.scene.start(SceneKeys.Upgrades)
    });

    createTextButton(this, {
      label: "Menu",
      icon: "menu",
      x: GAME_WIDTH / 2 + 240,
      y: GAME_HEIGHT - 92,
      width: 210,
      height: 54,
      onClick: () => this.scene.start(SceneKeys.Menu)
    });
  }
}
