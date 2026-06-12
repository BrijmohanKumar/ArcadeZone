import Phaser from "phaser";
import { getTankSkin } from "../data/tankSkins";
import { GAME_HEIGHT, GAME_WIDTH, Palette, SceneKeys } from "../game/constants";
import { MultiplayerClient, type MultiplayerLobbyState } from "../multiplayer/MultiplayerClient";
import { saveSystem } from "../systems/SaveSystem";
import { sfxSystem } from "../systems/SfxSystem";
import { createTextButton } from "../ui/Button";

const MAX_LOBBY_PLAYERS = 8;
const LOBBY_WAIT_MS = 30_000;
const LOBBY_LAUNCH_DELAY_MS = 3_000;
const BOT_NAMES = ["Maya", "Arjun", "Zara", "Leo", "Nora", "Isha", "Kabir"];

type LobbyPlayer = {
  color: number;
  id?: string;
  joinedAt: number;
  name: string;
  x?: number;
  y?: number;
};

export class LobbyScene extends Phaser.Scene {
  private readonly players: LobbyPlayer[] = [];
  private readonly slotTexts: Phaser.GameObjects.Text[] = [];
  private readonly slotFrames: Phaser.GameObjects.Graphics[] = [];
  private readonly joinSchedule: number[] = [];
  private startAt = 0;
  private nextJoinIndex = 0;
  private started = false;
  private launching = false;
  private launchAt = 0;
  private launchTimer?: Phaser.Time.TimerEvent;
  private timerText?: Phaser.GameObjects.Text;
  private countText?: Phaser.GameObjects.Text;
  private progressBar?: Phaser.GameObjects.Rectangle;
  private multiplayerClient?: MultiplayerClient;
  private multiplayerRequested = false;
  private multiplayerConnected = false;
  private multiplayerFallbackStarted = false;
  private handingOffToMatch = false;
  private readonly multiplayerUnsubscribes: Array<() => void> = [];

  constructor() {
    super(SceneKeys.Lobby);
  }

  create(): void {
    this.players.length = 0;
    this.slotTexts.length = 0;
    this.slotFrames.length = 0;
    this.joinSchedule.length = 0;
    this.nextJoinIndex = 0;
    this.started = false;
    this.launching = false;
    this.multiplayerRequested = false;
    this.multiplayerConnected = false;
    this.multiplayerFallbackStarted = false;
    this.handingOffToMatch = false;
    this.multiplayerUnsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());
    this.multiplayerClient = undefined;
    this.launchAt = 0;
    this.launchTimer?.remove(false);
    this.launchTimer = undefined;
    this.startAt = Date.now();

    sfxSystem.registerScene(this);
    this.cameras.main.setBackgroundColor(Palette.background);
    this.drawBackground();
    this.drawHeader();
    this.drawLobbyPanel();
    this.addPlayer(this.getSavedPlayerName(), this.getSavedPlayerSkinColor());
    this.multiplayerRequested = Boolean(MultiplayerClient.getRequestedUrl());

    if (this.multiplayerRequested) {
      void this.startMultiplayerLobby();
    } else {
      this.createJoinSchedule();
    }

    this.updateLobbyText(this.startAt);
    sfxSystem.startLobbyMusic(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.launchTimer?.remove(false);
      this.launchTimer = undefined;
      this.multiplayerUnsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());

      if (this.multiplayerClient && !this.handingOffToMatch) {
        this.multiplayerClient.close();
      }

      sfxSystem.stopLobbyMusic();
    });
  }

  update(_time: number): void {
    if (this.started) {
      return;
    }

    const now = Date.now();

    if (this.multiplayerConnected) {
      this.updateMultiplayerLobbyText();
      return;
    }

    if (this.multiplayerRequested && !this.multiplayerFallbackStarted) {
      return;
    }

    if (this.launching) {
      this.updateLobbyText(now);

      if (this.launchAt > 0 && now >= this.launchAt) {
        this.startMatch();
      }

      return;
    }

    const elapsed = now - this.startAt;
    const remainingMs = Math.max(0, LOBBY_WAIT_MS - elapsed);

    if (this.players.length < MAX_LOBBY_PLAYERS && this.nextJoinIndex < this.joinSchedule.length && elapsed >= this.joinSchedule[this.nextJoinIndex]) {
      this.addPlayer(BOT_NAMES[this.nextJoinIndex] ?? `Player ${this.nextJoinIndex + 2}`, this.getPlayerColor(this.nextJoinIndex));
      this.nextJoinIndex += 1;
      sfxSystem.play("pickup", 0.75);
    }

    this.updateLobbyText(now);

    if (this.players.length >= MAX_LOBBY_PLAYERS || remainingMs <= 0) {
      this.beginLaunch(now);
    }
  }

  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x070b14, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.lineStyle(1, 0x23304d, 0.32);

    for (let x = -GAME_HEIGHT; x < GAME_WIDTH; x += 40) {
      graphics.lineBetween(x, 0, x + GAME_HEIGHT, GAME_HEIGHT);
    }

    graphics.fillStyle(0x101a2f, 0.92);
    graphics.fillRoundedRect(38, 28, GAME_WIDTH - 76, GAME_HEIGHT - 56, 16);
    graphics.lineStyle(2, 0x2d426a, 0.9);
    graphics.strokeRoundedRect(38, 28, GAME_WIDTH - 76, GAME_HEIGHT - 56, 16);

    this.add.circle(178, 424, 106, Palette.accent, 0.08).setBlendMode(Phaser.BlendModes.ADD);
    this.add.circle(794, 118, 132, Palette.danger, 0.06).setBlendMode(Phaser.BlendModes.ADD);
  }

  private drawHeader(): void {
    this.add
      .text(GAME_WIDTH / 2, 62, "Battle Lobby", {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "46px",
        fontStyle: "900"
      })
      .setOrigin(0.5)
      .setShadow(0, 0, "#67e8f9", 8, true, true);

  }

  private drawLobbyPanel(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Palette.panel, 0.96);
    graphics.fillRoundedRect(106, 132, GAME_WIDTH - 212, 288, 10);
    graphics.lineStyle(2, Palette.panelLight, 1);
    graphics.strokeRoundedRect(106, 132, GAME_WIDTH - 212, 288, 10);

    this.countText = this.add
      .text(148, 162, "", {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "20px",
        fontStyle: "800"
      })
      .setOrigin(0, 0.5);

    this.timerText = this.add
      .text(GAME_WIDTH - 148, 162, "", {
        color: "#fef3c7",
        fontFamily: "Arial, sans-serif",
        fontSize: "20px",
        fontStyle: "800"
      })
      .setOrigin(1, 0.5);

    this.add.rectangle(GAME_WIDTH / 2, 198, 620, 8, 0x0f172a, 1).setOrigin(0.5);
    this.progressBar = this.add.rectangle(GAME_WIDTH / 2 - 310, 198, 620, 8, Palette.accent, 1).setOrigin(0, 0.5);

    for (let index = 0; index < MAX_LOBBY_PLAYERS; index += 1) {
      const column = index % 4;
      const row = Math.floor(index / 4);
      const x = 120 + column * 184;
      const y = 224 + row * 84;
      const frame = this.add.graphics();
      const text = this.add
        .text(x + 70, y + 24, "", {
          color: Palette.mutedText,
          fontFamily: "Arial, sans-serif",
          fontSize: "15px",
          fontStyle: "800"
        })
        .setOrigin(0, 0.5);

      this.slotFrames.push(frame);
      this.slotTexts.push(text);
      this.drawSlot(index);
    }

    createTextButton(this, {
      label: "Cancel",
      x: GAME_WIDTH / 2,
      y: 468,
      width: 180,
      height: 42,
      onClick: () => this.cancelLobby()
    });
  }

  private createJoinSchedule(): void {
    let nextJoinAt = Phaser.Math.Between(2200, 3600);

    for (let index = 0; index < MAX_LOBBY_PLAYERS - 1; index += 1) {
      this.joinSchedule.push(nextJoinAt);
      nextJoinAt += Phaser.Math.Between(2500, 4300);
    }
  }

  private async startMultiplayerLobby(): Promise<void> {
    const url = MultiplayerClient.getRequestedUrl();

    if (!url) {
      this.startBotFallbackLobby();
      return;
    }

    const client = new MultiplayerClient(url);
    this.multiplayerClient = client;
    this.multiplayerUnsubscribes.push(
      client.on("lobby", (state) => this.applyMultiplayerLobbyState(state)),
      client.on("close", () => {
        if (!this.started && !this.handingOffToMatch) {
          this.startBotFallbackLobby();
        }
      }),
      client.on("error", () => {
        if (!this.started && !this.handingOffToMatch) {
          this.startBotFallbackLobby();
        }
      })
    );

    const connected = await client.connect({
      name: this.getSavedPlayerName(),
      color: this.getSavedPlayerSkinColor()
    });

    if (!connected && !this.started && !this.handingOffToMatch) {
      this.startBotFallbackLobby();
      return;
    }

    this.multiplayerConnected = connected;

    if (client.lastLobbyState) {
      this.applyMultiplayerLobbyState(client.lastLobbyState);
    }
  }

  private startBotFallbackLobby(): void {
    if (this.multiplayerFallbackStarted || this.started) {
      return;
    }

    this.multiplayerUnsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());
    this.multiplayerClient?.close();
    this.multiplayerClient = undefined;
    this.multiplayerRequested = false;
    this.multiplayerConnected = false;
    this.multiplayerFallbackStarted = true;
    this.startAt = Date.now();
    this.createJoinSchedule();
    this.updateLobbyText(this.startAt);
  }

  private applyMultiplayerLobbyState(state: MultiplayerLobbyState): void {
    this.multiplayerConnected = true;
    this.players.length = 0;

    state.players.forEach((player) => {
      this.players.push({
        id: player.id,
        name: player.name,
        color: player.color,
        joinedAt: Date.now(),
        x: player.x,
        y: player.y
      });
    });

    for (let index = 0; index < MAX_LOBBY_PLAYERS; index += 1) {
      this.drawSlot(index);
    }

    this.updateMultiplayerLobbyText(state);

    if (state.phase === "countdown") {
      this.startMultiplayerMatch(state);
    }
  }

  private updateMultiplayerLobbyText(state = this.multiplayerClient?.lastLobbyState): void {
    if (!state) {
      this.countText?.setText(`${this.players.length}/${MAX_LOBBY_PLAYERS} players`);
      this.timerText?.setText("Connecting");
      this.progressBar?.setScale(0.15, 1);
      return;
    }

    const remainingSeconds = Math.max(0, Math.ceil(state.startsInMs / 1000));
    const progress = state.phase === "countdown" ? 1 : 1 - Phaser.Math.Clamp(state.startsInMs / LOBBY_WAIT_MS, 0, 1);

    this.countText?.setText(`${state.players.length}/${state.maxPlayers} players`);
    this.timerText?.setText(state.phase === "countdown" ? `Battle in ${remainingSeconds}s` : `Starts in ${remainingSeconds}s`);
    this.progressBar?.setScale(progress, 1);
  }

  private startMultiplayerMatch(state: MultiplayerLobbyState): void {
    if (this.started || !this.multiplayerClient) {
      return;
    }

    this.started = true;
    this.launching = true;
    this.handingOffToMatch = true;
    sfxSystem.stopLobbyMusic();
    sfxSystem.play("start");
    this.scene.start(SceneKeys.Match, {
      playerCount: state.players.length,
      playerName: state.players.find((player) => player.id === this.multiplayerClient?.playerId)?.name ?? this.getSavedPlayerName(),
      rivalNames: state.players.filter((player) => player.id !== this.multiplayerClient?.playerId).map((player) => player.name),
      multiplayerClient: this.multiplayerClient,
      multiplayerPlayers: state.players,
      multiplayerCountdownMs: state.countdownMs
    });
  }

  private addPlayer(name: string, color: number): void {
    if (this.players.length >= MAX_LOBBY_PLAYERS) {
      return;
    }

    this.players.push({ name, color, joinedAt: Date.now() });
    this.drawSlot(this.players.length - 1);
  }

  private drawSlot(index: number): void {
    const frame = this.slotFrames[index];
    const text = this.slotTexts[index];

    if (!frame || !text) {
      return;
    }

    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = 120 + column * 184;
    const y = 224 + row * 84;
    const player = this.players[index];

    frame.clear();
    frame.fillStyle(player ? 0x1b2b45 : 0x111827, 0.96);
    frame.fillRoundedRect(x, y, 166, 62, 8);
    frame.lineStyle(2, player ? player.color : Palette.panelLight, player ? 0.95 : 0.6);
    frame.strokeRoundedRect(x, y, 166, 62, 8);

    if (player) {
      this.drawSlotTank(frame, x + 14, y + 15, player.color);
      text.setColor(Palette.text);
      text.setText(`${player.name}\nReady`);
      return;
    }

    frame.lineStyle(2, 0x33466f, 0.52);
    frame.strokeRoundedRect(x + 14, y + 15, 50, 32, 7);
    frame.lineStyle(2, 0x33466f, 0.34);
    frame.lineBetween(x + 66, y + 31, x + 88, y + 31);
    text.setColor(Palette.mutedText);
    text.setText("Waiting\nOpen slot");
  }

  private drawSlotTank(graphics: Phaser.GameObjects.Graphics, x: number, y: number, color: number): void {
    graphics.fillStyle(color, 0.16);
    graphics.fillRoundedRect(x - 4, y - 5, 66, 42, 9);
    graphics.fillStyle(0x0f172a, 1);
    graphics.fillRoundedRect(x, y, 50, 32, 7);
    graphics.fillStyle(0x020617, 1);
    graphics.fillRoundedRect(x + 2, y + 2, 46, 7, 3);
    graphics.fillRoundedRect(x + 2, y + 23, 46, 7, 3);
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(x + 8, y + 8, 34, 16, 4);
    graphics.fillStyle(0xe2e8f0, 1);
    graphics.fillRoundedRect(x + 30, y + 13, 34, 6, 3);
    graphics.lineStyle(2, 0xffffff, 0.5);
    graphics.strokeRoundedRect(x + 8, y + 8, 34, 16, 4);
  }

  private updateLobbyText(now = Date.now()): void {
    const elapsed = Math.max(0, now - this.startAt);
    const remainingSeconds = Math.max(0, Math.ceil((LOBBY_WAIT_MS - elapsed) / 1000));
    const filled = this.players.length;
    const progress = Phaser.Math.Clamp(elapsed / LOBBY_WAIT_MS, 0, 1);

    this.countText?.setText(`${filled}/${MAX_LOBBY_PLAYERS} players`);
    this.progressBar?.setScale(this.launching ? 1 : 1 - progress, 1);

    if (this.launching) {
      this.timerText?.setText("Launching");
      return;
    }

    this.timerText?.setText(`Starts in ${remainingSeconds}s`);
  }

  private beginLaunch(now = Date.now()): void {
    if (this.launching || this.started) {
      return;
    }

    this.launching = true;
    this.launchAt = now + LOBBY_LAUNCH_DELAY_MS;
    this.launchTimer?.remove(false);
    this.launchTimer = undefined;
    sfxSystem.stopLobbyMusic();
    sfxSystem.play("ui");
    this.updateLobbyText(now);
  }

  private startMatch(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.launchTimer?.remove(false);
    this.launchTimer = undefined;
    const playerCount = Phaser.Math.Clamp(this.players.length, 2, MAX_LOBBY_PLAYERS);
    sfxSystem.play("start");
    this.scene.start(SceneKeys.Match, {
      playerCount,
      playerName: this.players[0]?.name ?? this.getSavedPlayerName(),
      rivalNames: this.players.slice(1).map((player) => player.name)
    });
  }

  private cancelLobby(): void {
    this.multiplayerClient?.close();
    this.scene.start(SceneKeys.Menu);
  }

  private getPlayerColor(index: number): number {
    const colors = [Palette.danger, Palette.warning, 0xa78bfa, Palette.accent, 0xf97316, 0x38bdf8, 0xf472b6];
    return colors[index % colors.length];
  }

  private getSavedPlayerName(): string {
    return saveSystem.loadProgress().playerName.trim() || "Player";
  }

  private getSavedPlayerSkinColor(): number {
    return getTankSkin(saveSystem.loadProgress().tankSkin).primary;
  }
}
