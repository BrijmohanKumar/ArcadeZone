import Phaser from "phaser";
import type { MatchResultData, MatchStanding } from "../data/matchResults";
import { getTankSkin } from "../data/tankSkins";
import { getAmmoPreserveChance } from "../data/upgrades";
import { WEAPON_DEFINITIONS, type WeaponDefinition, type WeaponId } from "../data/weapons";
import { Bullet } from "../entities/Bullet";
import { EnemyTarget } from "../entities/EnemyTarget";
import { LootDrop } from "../entities/LootDrop";
import { Player, type MovementInput } from "../entities/Player";
import { RechargePickup, type RechargePickupConfig, type RechargePickupType } from "../entities/RechargePickup";
import { WeaponPickup } from "../entities/WeaponPickup";
import { ARENA_BOUNDS, GAME_HEIGHT, GAME_WIDTH, Palette, SceneKeys } from "../game/constants";
import {
  MultiplayerClient,
  type MultiplayerLobbyPlayer,
  type MultiplayerMatchEnded,
  type MultiplayerSnapshot
} from "../multiplayer/MultiplayerClient";
import { playablesBridge } from "../platform/PlayablesBridge";
import { saveSystem } from "../systems/SaveSystem";
import { sfxSystem } from "../systems/SfxSystem";
import { createTextButton } from "../ui/Button";
import { TouchControls } from "../ui/TouchControls";
import { TutorialGuide, type TutorialStepId } from "../ui/TutorialGuide";

type MovementKeys = {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
};

type ActionKeys = {
  fire: Phaser.Input.Keyboard.Key;
  interact: Phaser.Input.Keyboard.Key;
  slot1: Phaser.Input.Keyboard.Key;
  slot2: Phaser.Input.Keyboard.Key;
  slot3: Phaser.Input.Keyboard.Key;
  slot4: Phaser.Input.Keyboard.Key;
  mute: Phaser.Input.Keyboard.Key;
  pause: Phaser.Input.Keyboard.Key;
};

type EnemyLoadout = {
  weaponId: WeaponId;
  ammo: number;
  armorShards: number;
  coinShards: number;
  lastShotAt: number;
};

type EnemyStandingStats = {
  name: string;
  score: number;
  coinShards: number;
  eliminatedAt?: number;
};

type BotObjective =
  | { kind: "combat" }
  | { kind: "flee"; x: number; y: number }
  | { kind: "separate"; x: number; y: number }
  | { kind: "safeZone"; x: number; y: number }
  | { kind: "weapon"; index: number; x: number; y: number }
  | { kind: "recharge"; index: number; x: number; y: number }
  | { kind: "loot"; index: number; x: number; y: number };

type BotCombatTarget = {
  x: number;
  y: number;
  kind: "player" | "rival";
};

type BotMovementState = {
  sampleX: number;
  sampleY: number;
  sampleAt: number;
  stuckStartedAt: number;
  unstuckUntil: number;
  unstuckX: number;
  unstuckY: number;
};

type MatchSceneData = {
  playerCount?: number;
  playerName?: string;
  rivalNames?: string[];
  multiplayerClient?: MultiplayerClient;
  multiplayerPlayers?: MultiplayerLobbyPlayer[];
  multiplayerCountdownMs?: number;
};

type SpawnPoint = {
  x: number;
  y: number;
};

type SafeZonePhase = {
  startAt: number;
  endAt: number;
  fromRadius: number;
  toRadius: number;
};

const WEAPON_SLOT_ORDER: WeaponId[] = ["pistol", "smg", "shotgun", "rifle"];
const WEAPON_RANK: Record<WeaponId, number> = {
  pistol: 1,
  smg: 2,
  shotgun: 3,
  rifle: 4
};
const SAFE_ZONE_CENTER = {
  x: GAME_WIDTH / 2,
  y: ARENA_BOUNDS.y + ARENA_BOUNDS.height / 2
} as const;
const SAFE_ZONE_PHASES: SafeZonePhase[] = [
  { startAt: 0, endAt: 16, fromRadius: 480, toRadius: 480 },
  { startAt: 16, endAt: 46, fromRadius: 480, toRadius: 280 },
  { startAt: 46, endAt: 78, fromRadius: 280, toRadius: 170 },
  { startAt: 78, endAt: 110, fromRadius: 170, toRadius: 92 }
];
const MATCH_COUNTDOWN_MS = 3000;
const BATTLE_BEGIN_MS = 850;
const OUTSIDE_ZONE_DAMAGE_PER_SECOND = 8;
const BOT_OUTSIDE_ZONE_DAMAGE_PER_SECOND = 6;
const BOT_FIRE_COOLDOWN_MULTIPLIER = 2.15;
const BOT_DAMAGE_MULTIPLIER = 0.42;
const BOT_PLAYER_TARGET_DISTANCE_PENALTY = 70;
const BOT_PLAYER_OPENING_TARGET_PENALTY = 110;
const DAMAGE_SCORE_MULTIPLIER = 1.2;
const KILL_SCORE_BONUS = 50;
const WEAPON_PICKUP_SCORE = 10;
const SURVIVAL_SCORE_PER_SECOND = 1;
const LAST_SURVIVOR_SCORE_BONUS = 50;
const COIN_SCORE_DIVISOR = 15;
const SUPPORT_PICKUP_SPAWN_MIN_MS = 6200;
const SUPPORT_PICKUP_SPAWN_MAX_MS = 11800;
const MAX_RECHARGE_PICKUPS = 6;
const SUPPORT_PICKUP_SPAWN_PADDING = 58;
const PLAYER_SPAWN_PADDING = 76;
const PLAYER_SPAWN_MIN_DISTANCE = 152;

export class MatchScene extends Phaser.Scene {
  private readonly bullets: Bullet[] = [];
  private readonly enemies: EnemyTarget[] = [];
  private readonly weaponPickups: WeaponPickup[] = [];
  private readonly lootDrops: LootDrop[] = [];
  private readonly rechargePickups: RechargePickup[] = [];
  private readonly collectedWeapons = new Set<WeaponId>();
  private readonly enemyLoadouts = new Map<EnemyTarget, EnemyLoadout>();
  private readonly enemyStandingStats = new Map<EnemyTarget, EnemyStandingStats>();
  private readonly botMovementStates = new Map<EnemyTarget, BotMovementState>();
  private readonly eliminatedEnemies: EnemyTarget[] = [];
  private readonly countdownTimers: Phaser.Time.TimerEvent[] = [];
  private readonly matchSpawnPoints: SpawnPoint[] = [];
  private readonly touchAimTarget = new Phaser.Math.Vector2(GAME_WIDTH / 2 + 120, GAME_HEIGHT / 2);
  private player?: Player;
  private cursorKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
  private movementKeys?: MovementKeys;
  private actionKeys?: ActionKeys;
  private touchControls?: TouchControls;
  private tutorialGuide?: TutorialGuide;
  private aimReticle?: Phaser.GameObjects.Arc;
  private weaponText?: Phaser.GameObjects.Text;
  private healthBarFill?: Phaser.GameObjects.Rectangle;
  private shieldBarFill?: Phaser.GameObjects.Rectangle;
  private pickupPromptText?: Phaser.GameObjects.Text;
  private scoreText?: Phaser.GameObjects.Text;
  private killsText?: Phaser.GameObjects.Text;
  private timerText?: Phaser.GameObjects.Text;
  private safeZoneText?: Phaser.GameObjects.Text;
  private soundText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private countdownOverlay?: Phaser.GameObjects.Container;
  private countdownText?: Phaser.GameObjects.Text;
  private countdownSubtext?: Phaser.GameObjects.Text;
  private pauseOverlay?: Phaser.GameObjects.Container;
  private safeZoneGraphics?: Phaser.GameObjects.Graphics;
  private safeZoneRadius = SAFE_ZONE_PHASES[0].fromRadius;
  private lastZoneWarningAt = Number.NEGATIVE_INFINITY;
  private lastZoneDamageTickAt = Number.NEGATIVE_INFINITY;
  private nextRechargeSpawnAt = Number.POSITIVE_INFINITY;
  private activeWeaponId: WeaponId = "pistol";
  private inventoryAmmo: Record<WeaponId, number> = {
    pistol: WEAPON_DEFINITIONS.pistol.ammoCapacity,
    smg: 0,
    shotgun: 0,
    rifle: 0
  };
  private lastShotAt = Number.NEGATIVE_INFINITY;
  private score = 0;
  private kills = 0;
  private damageDealt = 0;
  private armorShards = 0;
  private coinShards = 0;
  private playerMaxHealth = 100;
  private playerHealth = 100;
  private playerMaxShield = 50;
  private playerShield = 50;
  private ammoEfficiencyLevel = 0;
  private playerAlive = true;
  private matchStartAt = 0;
  private countdownEndsAt = 0;
  private battleBeginEndsAt = 0;
  private lastCountdownNumber = 0;
  private battleBeginStarted = false;
  private matchActive = false;
  private matchPaused = false;
  private pauseStartedAt = 0;
  private pauseReason: "manual" | "system" = "manual";
  private matchFinalized = false;
  private defaultStatusText = "Safe zone shrinks over time. Stay inside the blue circle.";
  private tutorialEnabled = false;
  private tutorialMoved = false;
  private tutorialFired = false;
  private tutorialCollected = false;
  private tutorialCollectedWeapon = false;
  private tutorialSwitched = false;
  private tutorialZoneStartedAt = Number.NEGATIVE_INFINITY;
  private currentTutorialStep?: TutorialStepId;
  private playablesLifecycleRegistered = false;
  private arenaPlayerCount = 5;
  private playerDisplayName = "Player";
  private rivalDisplayNames: string[] = [];
  private multiplayerClient?: MultiplayerClient;
  private multiplayerPlayers: MultiplayerLobbyPlayer[] = [];
  private multiplayerCountdownMs = MATCH_COUNTDOWN_MS;
  private readonly multiplayerRemoteTargets = new Map<string, EnemyTarget>();
  private readonly multiplayerBulletSprites = new Map<string, Phaser.GameObjects.Arc>();
  private readonly multiplayerUnsubscribes: Array<() => void> = [];
  private lastMultiplayerInputAt = 0;
  private multiplayerMatchEnded = false;
  private readonly handleDocumentVisibilityChange = (): void => {
    if (document.hidden) {
      this.pauseMatch("system");
    }
  };
  private readonly handleWindowBlur = (): void => {
    this.pauseMatch("system");
  };
  private readonly handlePlayablesPause = (): void => {
    this.pauseMatch("system");
  };
  private readonly handlePlayablesResume = (): void => {
    if (this.matchPaused && this.pauseReason === "system") {
      this.resumeMatch();
    }
  };

  constructor() {
    super(SceneKeys.Match);
  }

  init(data?: MatchSceneData): void {
    this.arenaPlayerCount = Phaser.Math.Clamp(Math.round(data?.playerCount ?? 5), 2, 8);
    this.playerDisplayName = this.sanitizeDisplayName(data?.playerName ?? "Player");
    this.rivalDisplayNames = (data?.rivalNames ?? []).map((name) => this.sanitizeDisplayName(name));
    this.multiplayerClient = data?.multiplayerClient;
    this.multiplayerPlayers = data?.multiplayerPlayers ?? [];
    this.multiplayerCountdownMs = Phaser.Math.Clamp(Math.round(data?.multiplayerCountdownMs ?? MATCH_COUNTDOWN_MS), 400, MATCH_COUNTDOWN_MS);
  }

  create(): void {
    this.resetMatchState();
    sfxSystem.registerScene(this);
    this.registerLifecycleHandlers();
    this.countdownEndsAt = this.getNow() + (this.isMultiplayerMatch() ? this.multiplayerCountdownMs : MATCH_COUNTDOWN_MS);
    this.matchStartAt = this.countdownEndsAt;
    this.cameras.main.setBackgroundColor(0x101827);
    this.input.setDefaultCursor("crosshair");
    this.drawArena();
    this.createSafeZoneOverlay();
    this.matchSpawnPoints.push(...(this.isMultiplayerMatch() ? this.createMultiplayerSpawnPoints() : this.createMatchSpawnPoints(this.arenaPlayerCount)));
    this.createPlayer();
    if (this.isMultiplayerMatch()) {
      this.createMultiplayerEnemyTargets();
      this.registerMultiplayerHandlers();
    } else {
      this.createEnemyTargets();
      this.createWeaponPickups();
      this.createRechargePickups();
    }
    this.createInput();
    this.createAimReticle();
    this.drawHud();
    this.createTouchControls();
    if (!this.isMultiplayerMatch()) {
      this.createTutorialGuide();
    }
    this.updateSafeZone(0);
    this.createCountdownOverlay();
  }

  update(_time: number, delta: number): void {
    const now = this.getNow();

    this.updateTimerHud();

    if (this.matchFinalized) {
      return;
    }

    if (this.matchPaused) {
      return;
    }

    const activePointer = this.input.activePointer;
    const aimTarget = this.getAimTarget(activePointer);
    if (this.playerAlive) {
      const movementInput = this.getMovementInput();

      if (movementInput.x !== 0 || movementInput.y !== 0) {
        this.tutorialMoved = true;
      }

      this.player?.setAimTarget(aimTarget.x, aimTarget.y);
      this.player?.update(delta, movementInput, ARENA_BOUNDS);
    }
    this.aimReticle?.setPosition(aimTarget.x, aimTarget.y);
    this.updateTutorialGuide();

    this.updateCountdownOverlay();

    if (this.isMultiplayerMatch()) {
      this.sendMultiplayerInput(now);

      if (!this.matchActive) {
        return;
      }

      this.updateSafeZone(delta);
      this.syncMultiplayerSnapshot(delta);

      if (this.playerAlive) {
        this.handleWeaponControls();
      }

      return;
    }

    if (!this.matchActive) {
      if (this.playerAlive) {
        this.handleWeaponControls();
        this.updatePickupHighlights();
      }

      return;
    }

    this.updateSafeZone(delta);
    this.updateRandomRechargePickups(now);
    this.handleShooting(now);
    this.updateBots(now, delta);
    this.updateBullets(delta);
    this.applySafeZoneDamage(delta);
    if (this.playerAlive) {
      this.handleWeaponControls();
      this.updatePickupHighlights();
    }
  }

  private drawArena(): void {
    const graphics = this.add.graphics();
    graphics.setDepth(0);

    graphics.fillStyle(0x070b14, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    graphics.lineStyle(1, 0x1f2a44, 0.34);
    for (let x = -GAME_HEIGHT; x < GAME_WIDTH; x += 44) {
      graphics.lineBetween(x, 0, x + GAME_HEIGHT, GAME_HEIGHT);
    }

    graphics.fillStyle(0x050816, 0.45);
    graphics.fillRoundedRect(ARENA_BOUNDS.x - 18, ARENA_BOUNDS.y - 18, ARENA_BOUNDS.width + 36, ARENA_BOUNDS.height + 36, 18);

    graphics.fillStyle(Palette.arena, 1);
    graphics.fillRoundedRect(ARENA_BOUNDS.x, ARENA_BOUNDS.y, ARENA_BOUNDS.width, ARENA_BOUNDS.height, 10);

    const tileSize = 56;
    for (let y = ARENA_BOUNDS.y + 10; y < ARENA_BOUNDS.y + ARENA_BOUNDS.height - 10; y += tileSize) {
      for (let x = ARENA_BOUNDS.x + 10; x < ARENA_BOUNDS.x + ARENA_BOUNDS.width - 10; x += tileSize) {
        const checker = ((x + y) / tileSize) % 2 < 1;
        graphics.fillStyle(checker ? 0x2a3a59 : 0x23324f, 0.32);
        graphics.fillRect(x, y, tileSize - 2, tileSize - 2);
      }
    }

    graphics.lineStyle(1, 0x52688f, 0.4);
    for (let x = ARENA_BOUNDS.x + 56; x < ARENA_BOUNDS.x + ARENA_BOUNDS.width; x += 56) {
      graphics.lineBetween(x, ARENA_BOUNDS.y + 8, x, ARENA_BOUNDS.y + ARENA_BOUNDS.height - 8);
    }
    for (let y = ARENA_BOUNDS.y + 56; y < ARENA_BOUNDS.y + ARENA_BOUNDS.height; y += 56) {
      graphics.lineBetween(ARENA_BOUNDS.x + 8, y, ARENA_BOUNDS.x + ARENA_BOUNDS.width - 8, y);
    }

    const pads = [
      { x: ARENA_BOUNDS.x + 96, y: ARENA_BOUNDS.y + 82, width: 128, height: 54, color: Palette.accent },
      { x: ARENA_BOUNDS.x + ARENA_BOUNDS.width - 220, y: ARENA_BOUNDS.y + 76, width: 142, height: 58, color: Palette.danger },
      { x: ARENA_BOUNDS.x + 126, y: ARENA_BOUNDS.y + ARENA_BOUNDS.height - 126, width: 148, height: 62, color: 0xa78bfa },
      { x: ARENA_BOUNDS.x + ARENA_BOUNDS.width - 236, y: ARENA_BOUNDS.y + ARENA_BOUNDS.height - 118, width: 158, height: 58, color: Palette.warning }
    ];

    pads.forEach((pad) => {
      graphics.fillStyle(pad.color, 0.1);
      graphics.fillRoundedRect(pad.x, pad.y, pad.width, pad.height, 8);
      graphics.lineStyle(2, pad.color, 0.32);
      graphics.strokeRoundedRect(pad.x, pad.y, pad.width, pad.height, 8);
    });

    graphics.lineStyle(4, 0x38bdf8, 0.32);
    graphics.strokeCircle(SAFE_ZONE_CENTER.x, SAFE_ZONE_CENTER.y, 160);
    graphics.lineStyle(2, 0xfacc15, 0.45);
    graphics.strokeCircle(SAFE_ZONE_CENTER.x, SAFE_ZONE_CENTER.y, 52);

    graphics.lineStyle(3, Palette.arenaLine, 1);
    graphics.strokeRoundedRect(ARENA_BOUNDS.x, ARENA_BOUNDS.y, ARENA_BOUNDS.width, ARENA_BOUNDS.height, 10);
    graphics.lineStyle(5, Palette.danger, 0.2);
    graphics.strokeRoundedRect(ARENA_BOUNDS.x - 6, ARENA_BOUNDS.y - 6, ARENA_BOUNDS.width + 12, ARENA_BOUNDS.height + 12, 14);
  }

  private createSafeZoneOverlay(): void {
    this.safeZoneGraphics = this.add.graphics();
    this.safeZoneGraphics.setDepth(2);
    this.updateSafeZone(0);
  }

  private updateSafeZone(_delta: number): void {
    const elapsedSeconds = this.getMatchElapsedSeconds();
    const phase = this.getSafeZonePhase(elapsedSeconds);
    const phaseProgress = Phaser.Math.Clamp((elapsedSeconds - phase.startAt) / Math.max(1, phase.endAt - phase.startAt), 0, 1);
    this.safeZoneRadius = Phaser.Math.Linear(phase.fromRadius, phase.toRadius, phaseProgress);

    const isShrinking = phase.fromRadius !== phase.toRadius && phaseProgress > 0 && phaseProgress < 1;
    this.safeZoneGraphics?.clear();
    const pulse = 0.5 + Math.sin(this.getNow() / 220) * 0.5;
    this.safeZoneGraphics?.fillStyle(0x38bdf8, 0.045 + pulse * 0.025);
    this.safeZoneGraphics?.fillCircle(SAFE_ZONE_CENTER.x, SAFE_ZONE_CENTER.y, this.safeZoneRadius);
    this.safeZoneGraphics?.lineStyle(isShrinking ? 5 : 3, 0x7dd3fc, isShrinking ? 1 : 0.86);
    this.safeZoneGraphics?.strokeCircle(SAFE_ZONE_CENTER.x, SAFE_ZONE_CENTER.y, this.safeZoneRadius);
    this.safeZoneGraphics?.lineStyle(2, 0xb7f7ff, 0.25 + pulse * 0.3);
    this.safeZoneGraphics?.strokeCircle(SAFE_ZONE_CENTER.x, SAFE_ZONE_CENTER.y, Math.max(12, this.safeZoneRadius - 8));
    this.safeZoneGraphics?.lineStyle(9, 0xef4444, 0.16);
    this.safeZoneGraphics?.strokeCircle(SAFE_ZONE_CENTER.x, SAFE_ZONE_CENTER.y, this.safeZoneRadius + 8);
    this.safeZoneGraphics?.lineStyle(1, 0xffffff, 0.22);
    this.safeZoneGraphics?.strokeCircle(SAFE_ZONE_CENTER.x, SAFE_ZONE_CENTER.y, this.safeZoneRadius + 2 + pulse * 5);

    this.cullPickupsOutsideSafeZone();
    this.safeZoneText?.setText(this.getSafeZoneHudText(elapsedSeconds, phase));
  }

  private getSafeZonePhase(elapsedSeconds: number): SafeZonePhase {
    return (
      SAFE_ZONE_PHASES.find((phase) => elapsedSeconds >= phase.startAt && elapsedSeconds < phase.endAt) ??
      SAFE_ZONE_PHASES[SAFE_ZONE_PHASES.length - 1]
    );
  }

  private getSafeZoneHudText(elapsedSeconds: number, phase: SafeZonePhase): string {
    const nextPhase = SAFE_ZONE_PHASES.find((candidate) => candidate.startAt > elapsedSeconds);
    const radiusText = `Zone: ${Math.round(this.safeZoneRadius)}`;

    if (phase.fromRadius !== phase.toRadius && elapsedSeconds < phase.endAt) {
      return `${radiusText} shrinking`;
    }

    if (nextPhase) {
      return `${radiusText} shrink in ${Math.max(0, Math.ceil(nextPhase.startAt - elapsedSeconds))}s`;
    }

    return `${radiusText} final`;
  }

  private getRivalName(index: number): string {
    const fallbackNames = ["Maya", "Arjun", "Zara", "Leo", "Nora", "Isha", "Kabir"];
    return this.rivalDisplayNames[index] || fallbackNames[index] || `Player ${index + 2}`;
  }

  private sanitizeDisplayName(name: string): string {
    return name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 14) || "Player";
  }

  private isMultiplayerMatch(): boolean {
    return Boolean(this.multiplayerClient);
  }

  private createMultiplayerSpawnPoints(): SpawnPoint[] {
    const localId = this.multiplayerClient?.playerId;
    const localPlayer = this.multiplayerPlayers.find((player) => player.id === localId);
    const remotePlayers = this.multiplayerPlayers.filter((player) => player.id !== localId);
    const points = [
      localPlayer ? { x: localPlayer.x, y: localPlayer.y } : this.findMatchSpawnPoint([]),
      ...remotePlayers.map((player) => ({ x: player.x, y: player.y }))
    ];

    return points.length > 0 ? points : this.createMatchSpawnPoints(this.arenaPlayerCount);
  }

  private createMultiplayerEnemyTargets(): void {
    const localId = this.multiplayerClient?.playerId;

    this.multiplayerPlayers
      .filter((player) => player.id !== localId)
      .forEach((player) => {
        const enemy = new EnemyTarget(this, {
          x: player.x,
          y: player.y,
          name: player.name,
          color: player.color,
          maxHealth: 100,
          maxShield: 50,
          speed: 120,
          preferredRange: 240
        });

        this.multiplayerRemoteTargets.set(player.id, enemy);
      });
  }

  private createPlayer(): void {
    const progress = saveSystem.loadProgress();
    const spawnPoint = this.matchSpawnPoints[0] ?? {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 12
    };

    this.player = new Player(this, {
      x: spawnPoint.x,
      y: spawnPoint.y,
      name: this.playerDisplayName,
      skin: getTankSkin(progress.tankSkin)
    });
  }

  private createEnemyTargets(): void {
    const targetConfigs = [
      { x: 232, y: 166, name: this.getRivalName(0), color: 0xf97316, weaponId: "smg", ammo: 14, armorShards: 1, coinShards: 8, speed: 104, preferredRange: 245 },
      { x: 760, y: 184, name: this.getRivalName(1), color: 0xef4444, weaponId: "shotgun", ammo: 4, armorShards: 2, coinShards: 10, speed: 92, preferredRange: 190 },
      { x: 704, y: 392, name: this.getRivalName(2), color: 0xa855f7, weaponId: "rifle", ammo: 6, armorShards: 1, coinShards: 12, speed: 82, preferredRange: 310 },
      { x: 256, y: 382, name: this.getRivalName(3), color: 0xe11d48, weaponId: "pistol", ammo: 8, armorShards: 2, coinShards: 7, speed: 98, preferredRange: 230 },
      { x: 486, y: 418, name: this.getRivalName(4), color: 0x22c55e, weaponId: "smg", ammo: 16, armorShards: 1, coinShards: 9, speed: 100, preferredRange: 235 },
      { x: 522, y: 156, name: this.getRivalName(5), color: 0x38bdf8, weaponId: "rifle", ammo: 7, armorShards: 2, coinShards: 11, speed: 86, preferredRange: 300 },
      { x: 382, y: 318, name: this.getRivalName(6), color: 0xf472b6, weaponId: "smg", ammo: 18, armorShards: 1, coinShards: 8, speed: 106, preferredRange: 225 }
    ];
    const rivalCount = Phaser.Math.Clamp(this.arenaPlayerCount - 1, 1, targetConfigs.length);

    targetConfigs.slice(0, rivalCount).forEach(({ weaponId, ammo, armorShards, coinShards, ...target }, index) => {
      const spawnPoint = this.matchSpawnPoints[index + 1] ?? {
        x: target.x,
        y: target.y
      };
      const enemy = new EnemyTarget(this, {
        ...target,
        x: spawnPoint.x,
        y: spawnPoint.y,
        maxHealth: 45,
        maxShield: 25
      });

      this.enemies.push(enemy);
      this.enemyLoadouts.set(enemy, {
        weaponId: weaponId as WeaponId,
        ammo,
        armorShards,
        coinShards,
        lastShotAt: Phaser.Math.Between(-900, 100)
      });
      this.enemyStandingStats.set(enemy, {
        name: target.name,
        score: 0,
        coinShards: 0
      });
    });
  }

  private createMatchSpawnPoints(count: number): SpawnPoint[] {
    const totalPlayers = Phaser.Math.Clamp(Math.round(count), 2, 8);
    const spawnPoints: SpawnPoint[] = [];

    for (let index = 0; index < totalPlayers; index += 1) {
      spawnPoints.push(this.findMatchSpawnPoint(spawnPoints));
    }

    return spawnPoints;
  }

  private findMatchSpawnPoint(existingPoints: SpawnPoint[]): SpawnPoint {
    const minimumDistance = Math.max(112, PLAYER_SPAWN_MIN_DISTANCE - existingPoints.length * 8);

    for (let attempt = 0; attempt < 90; attempt += 1) {
      const point = this.getRandomArenaSpawnPoint();

      if (this.isSpawnPointClear(point, existingPoints, minimumDistance)) {
        return point;
      }
    }

    for (let attempt = 0; attempt < 70; attempt += 1) {
      const point = this.getRandomArenaSpawnPoint();

      if (this.isSpawnPointClear(point, existingPoints, 96)) {
        return point;
      }
    }

    return this.getRandomArenaSpawnPoint();
  }

  private getRandomArenaSpawnPoint(): SpawnPoint {
    return {
      x: Phaser.Math.Between(ARENA_BOUNDS.x + PLAYER_SPAWN_PADDING, ARENA_BOUNDS.x + ARENA_BOUNDS.width - PLAYER_SPAWN_PADDING),
      y: Phaser.Math.Between(ARENA_BOUNDS.y + PLAYER_SPAWN_PADDING, ARENA_BOUNDS.y + ARENA_BOUNDS.height - PLAYER_SPAWN_PADDING)
    };
  }

  private isSpawnPointClear(point: SpawnPoint, existingPoints: SpawnPoint[], minimumDistance: number): boolean {
    return existingPoints.every((existing) => Phaser.Math.Distance.Between(point.x, point.y, existing.x, existing.y) >= minimumDistance);
  }

  private createWeaponPickups(): void {
    const pickups = [
      { x: 164, y: 278, weapon: WEAPON_DEFINITIONS.smg, ammo: 32 },
      { x: 792, y: 302, weapon: WEAPON_DEFINITIONS.shotgun, ammo: 7 },
      { x: 480, y: 118, weapon: WEAPON_DEFINITIONS.rifle, ammo: 12 }
    ];

    pickups.forEach((pickup) => {
      this.weaponPickups.push(new WeaponPickup(this, pickup));
    });
  }

  private createRechargePickups(): void {
    const pickups = [
      { x: 354, y: 170, type: "shield" as const, shieldAmount: 32, ammoAmount: 0, healthAmount: 0 },
      { x: 622, y: 372, type: "ammo" as const, shieldAmount: 0, ammoAmount: 12, healthAmount: 0 },
      { x: 264, y: 424, type: "health" as const, shieldAmount: 0, ammoAmount: 0, healthAmount: 28 },
      { x: 512, y: 442, type: "combo" as const, shieldAmount: 22, ammoAmount: 7, healthAmount: 12 }
    ];

    pickups.forEach((pickup) => {
      this.rechargePickups.push(new RechargePickup(this, pickup));
    });
  }

  private createInput(): void {
    const keyboard = this.input.keyboard;

    if (!keyboard) {
      return;
    }

    keyboard.addCapture(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.cursorKeys = keyboard.createCursorKeys();
    this.movementKeys = keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    }) as MovementKeys;
    this.actionKeys = keyboard.addKeys({
      fire: Phaser.Input.Keyboard.KeyCodes.SPACE,
      interact: Phaser.Input.Keyboard.KeyCodes.E,
      slot1: Phaser.Input.Keyboard.KeyCodes.ONE,
      slot2: Phaser.Input.Keyboard.KeyCodes.TWO,
      slot3: Phaser.Input.Keyboard.KeyCodes.THREE,
      slot4: Phaser.Input.Keyboard.KeyCodes.FOUR,
      mute: Phaser.Input.Keyboard.KeyCodes.M,
      pause: Phaser.Input.Keyboard.KeyCodes.P
    }) as ActionKeys;

    keyboard.on("keydown-ESC", this.handlePauseKey, this);
    keyboard.on("keydown-P", this.handlePauseKey, this);
  }

  private createAimReticle(): void {
    this.aimReticle = this.add.circle(GAME_WIDTH / 2 + 60, GAME_HEIGHT / 2, 10, 0xffffff, 0);
    this.aimReticle.setStrokeStyle(2, Palette.aim, 0.9);
    this.aimReticle.setDepth(20);
  }

  private createTouchControls(): void {
    if (!this.shouldShowTouchControls()) {
      this.touchControls = undefined;
      return;
    }

    this.touchControls = new TouchControls(this);
  }

  private registerMultiplayerHandlers(): void {
    if (!this.multiplayerClient) {
      return;
    }

    this.multiplayerUnsubscribes.push(
      this.multiplayerClient.on("matchEnded", (result) => this.finalizeMultiplayerMatch(result)),
      this.multiplayerClient.on("close", () => {
        if (!this.matchFinalized) {
          this.showStatus("Multiplayer connection ended.", Palette.warning, 1200);
          this.time.delayedCall(900, () => this.finalizeMatch(false, "eliminated"));
        }
      })
    );
  }

  private shouldShowTouchControls(): boolean {
    const searchParams = new URLSearchParams(window.location.search);
    const forceTouchControls = searchParams.get("touch") === "1";
    const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

    return forceTouchControls || hasCoarsePointer;
  }

  private createTutorialGuide(): void {
    if (!this.tutorialEnabled) {
      return;
    }

    this.tutorialGuide = new TutorialGuide(this, () => {
      this.completeTutorialGuide();
      sfxSystem.play("ui");
    });
    this.updateTutorialGuide();
  }

  private updateTutorialGuide(): void {
    if (!this.tutorialEnabled || !this.tutorialGuide || this.tutorialGuide.isDismissed || this.matchFinalized) {
      return;
    }

    const elapsedSeconds = this.getMatchElapsedSeconds();

    if (!this.tutorialMoved) {
      this.showTutorialStep(
        "move",
        "Move",
        "Use WASD, arrow keys, or the left touch stick. Grab a safer position before combat starts.",
        "1/5"
      );
      return;
    }

    if (!this.tutorialFired) {
      this.showTutorialStep(
        "shoot",
        "Fire",
        "Aim at a rival and fire. Computer players can hold Space; mouse click and touch + also work.",
        "2/5"
      );
      return;
    }

    if (!this.tutorialCollected) {
      this.showTutorialStep(
        "pickup",
        "Loot",
        "Move near weapons, ammo, shield, or drops. Press E or the touch E button to collect.",
        "3/5"
      );
      return;
    }

    if (this.tutorialCollectedWeapon && !this.tutorialSwitched && this.collectedWeapons.size > 1) {
      this.showTutorialStep(
        "switch",
        "Switch",
        "Use 1-4 on keyboard or the > touch button to cycle collected weapons.",
        "4/5"
      );
      return;
    }

    this.showTutorialStep(
      "zone",
      "Safe Zone",
      elapsedSeconds < 12
        ? "The blue circle is safe. When it starts shrinking, stay inside it and keep moving."
        : "Stay inside the blue circle. The red edge means shield and health damage outside.",
      "5/5"
    );

    if (!Number.isFinite(this.tutorialZoneStartedAt)) {
      this.tutorialZoneStartedAt = this.getNow();
    }

    if (this.getNow() - this.tutorialZoneStartedAt > 4600) {
      this.completeTutorialGuide();
    }
  }

  private showTutorialStep(id: TutorialStepId, title: string, body: string, progress: string): void {
    if (this.currentTutorialStep !== id) {
      this.currentTutorialStep = id;
      sfxSystem.play("ui", 0.45);
    }

    this.tutorialGuide?.showStep({ id, title, body, progress });
  }

  private completeTutorialGuide(): void {
    if (!this.tutorialEnabled) {
      return;
    }

    this.tutorialEnabled = false;
    this.tutorialGuide?.hide();
    saveSystem.markTutorialSeen();
  }

  private getAimTarget(pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    if (this.touchControls?.wantsAimAssist && this.player) {
      const target = this.findNearestAimTarget();

      if (target) {
        this.touchAimTarget.set(target.x, target.y);
        return this.touchAimTarget;
      }

      const aimAngle = this.player.getAimAngle();
      this.touchAimTarget.set(this.player.x + Math.cos(aimAngle) * 180, this.player.y + Math.sin(aimAngle) * 180);
      return this.touchAimTarget;
    }

    this.touchAimTarget.set(pointer.worldX, pointer.worldY);
    return this.touchAimTarget;
  }

  private findNearestAimTarget(): EnemyTarget | undefined {
    if (!this.player) {
      return undefined;
    }

    const maxDistance = Math.max(300, this.activeWeapon.range * 1.15);
    let nearestEnemy: EnemyTarget | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;

    this.enemies.forEach((enemy) => {
      if (!enemy.isAlive) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(this.player!.x, this.player!.y, enemy.x, enemy.y);

      if (distance <= maxDistance && distance < nearestDistance) {
        nearestEnemy = enemy;
        nearestDistance = distance;
      }
    });

    return nearestEnemy;
  }

  private createCountdownOverlay(): void {
    const shade = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020617, 0.3);
    const panel = this.add.graphics();

    panel.fillStyle(0x101a2f, 0.95);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 190, GAME_HEIGHT / 2 - 140, 380, 214, 16);
    panel.lineStyle(3, Palette.accent, 0.86);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 190, GAME_HEIGHT / 2 - 140, 380, 214, 16);

    this.countdownText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 38, "", {
        color: "#fef3c7",
        fontFamily: "Arial, sans-serif",
        fontSize: "96px",
        fontStyle: "900",
        stroke: "#0b1020",
        strokeThickness: 10
      })
      .setOrigin(0.5);

    this.countdownSubtext = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 42, "Get ready", {
        color: Palette.mutedText,
        fontFamily: "Arial, sans-serif",
        fontSize: "20px",
        fontStyle: "800"
      })
      .setOrigin(0.5);

    this.countdownOverlay = this.add.container(0, 0, [shade, panel, this.countdownText, this.countdownSubtext]);
    this.countdownOverlay.setDepth(70);

    this.statusText?.setText("Match starts soon. Move, aim, and grab nearby supplies.");
    this.statusText?.setColor("#fef3c7");
    this.startCountdownSequence();
  }

  private updateCountdownOverlay(): void {
    if (this.matchActive || this.matchFinalized) {
      return;
    }

    const now = this.getNow();

    if (this.battleBeginStarted) {
      if (now >= this.battleBeginEndsAt) {
        this.startLiveMatch();
      }
      return;
    }

    const remainingMs = this.countdownEndsAt - now;

    if (remainingMs > 0) {
      const countdownNumber = Phaser.Math.Clamp(Math.ceil(remainingMs / 1000), 1, 3);

      if (countdownNumber !== this.lastCountdownNumber) {
        this.showCountdownNumber(countdownNumber);
      }

      return;
    }

    this.showBattleBeginCountdown();
  }

  private startCountdownSequence(): void {
    this.clearCountdownTimers();
    this.lastCountdownNumber = 0;
    this.showCountdownNumber(3);
  }

  private showCountdownNumber(countdownNumber: number): void {
    if (this.matchFinalized || this.battleBeginStarted) {
      return;
    }

    this.lastCountdownNumber = countdownNumber;
    this.countdownText?.setText(`${countdownNumber}`).setColor("#fef3c7").setFontSize(104).setAlpha(1).setScale(0.6);
    this.countdownSubtext?.setText("Battle starts in").setColor(Palette.mutedText);
    this.statusText?.setText(`Battle starts in ${countdownNumber}...`);
    this.statusText?.setColor("#fef3c7");
    sfxSystem.play("countdown", 1.35);
    if (this.countdownText) {
      this.tweens.killTweensOf(this.countdownText);
    }
    this.tweens.add({
      targets: this.countdownText,
      scale: 1,
      duration: 240,
      ease: "Back.Out"
    });
  }

  private showBattleBeginCountdown(): void {
    if (this.battleBeginStarted || this.matchActive || this.matchFinalized) {
      return;
    }

    this.battleBeginStarted = true;
    this.battleBeginEndsAt = this.getNow() + BATTLE_BEGIN_MS;
    this.lastCountdownNumber = 0;
    this.countdownText?.setText("Battle Begin").setColor("#bbf7d0").setFontSize(56).setAlpha(1).setScale(0.72);
    this.countdownSubtext?.setText("Fight for the zone").setColor("#fef3c7");
    this.statusText?.setText("Battle begins now.");
    this.statusText?.setColor("#bbf7d0");
    sfxSystem.play("start");

    if (this.countdownText) {
      this.tweens.killTweensOf(this.countdownText);
    }
    this.tweens.add({
      targets: this.countdownText,
      scale: 1,
      duration: 220,
      ease: "Back.Out"
    });
  }

  private startLiveMatch(): void {
    if (this.matchActive || this.matchFinalized) {
      return;
    }

    this.matchActive = true;
    this.clearCountdownTimers();
    const now = this.getNow();
    this.matchStartAt = now;
    this.countdownEndsAt = now;
    this.lastShotAt = Number.NEGATIVE_INFINITY;
    this.lastZoneDamageTickAt = now;
    this.scheduleNextRechargeSpawn(now);
    this.statusText?.setText(this.defaultStatusText);
    this.statusText?.setColor(Palette.mutedText);
    this.enemyLoadouts.forEach((loadout) => {
      loadout.lastShotAt = now + Phaser.Math.Between(250, 900);
    });
    const countdownOverlay = this.countdownOverlay;

    if (!countdownOverlay) {
      return;
    }

    this.tweens.add({
      targets: countdownOverlay,
      alpha: 0,
      duration: 260,
      onComplete: () => {
        countdownOverlay.destroy(true);
        this.countdownOverlay = undefined;
        this.countdownText = undefined;
        this.countdownSubtext = undefined;
      }
    });
  }

  private clearCountdownTimers(): void {
    this.countdownTimers.forEach((timer) => timer.remove(false));
    this.countdownTimers.length = 0;
  }

  private drawHud(): void {
    this.add
      .text(62, 22, "Arena Zone", {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "20px",
        fontStyle: "800"
      })
      .setOrigin(0, 0.5);

    this.add
      .text(190, 22, `Pilot: ${this.playerDisplayName}`, {
        color: "#bbf7d0",
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
        fontStyle: "800",
        stroke: "#0b1020",
        strokeThickness: 3
      })
      .setOrigin(0, 0.5);

    this.createPauseButton();

    this.soundText = this.add
      .text(GAME_WIDTH - 82, 50, "", {
        color: Palette.mutedText,
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        fontStyle: "700"
      })
      .setOrigin(1, 0.5);
    this.updateSoundHud();

    this.weaponText = this.add.text(62, 48, "", {
      color: Palette.text,
      fontFamily: "Arial, sans-serif",
      fontSize: "13px",
      fontStyle: "700"
    }).setOrigin(0, 0.5);

    this.add.rectangle(62, 62, 120, 6, 0x1e293b, 1).setOrigin(0, 0.5);
    this.healthBarFill = this.add.rectangle(62, 62, 120, 6, Palette.danger, 1).setOrigin(0, 0.5);
    this.add.rectangle(188, 62, 120, 6, 0x1e293b, 1).setOrigin(0, 0.5);
    this.shieldBarFill = this.add.rectangle(188, 62, 120, 6, 0x67e8f9, 1).setOrigin(0, 0.5);
    this.updatePlayerHud();

    this.pickupPromptText = this.add
      .text(GAME_WIDTH / 2, 86, "", {
        color: "#bbf7d0",
        fontFamily: "Arial, sans-serif",
        fontSize: "15px",
        fontStyle: "800",
        stroke: "#0b1020",
        strokeThickness: 3
      })
      .setOrigin(0.5);
    this.updateWeaponHud();

    this.scoreText = this.add
      .text(GAME_WIDTH - 82, 68, "", {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "15px",
        fontStyle: "700"
      })
      .setOrigin(1, 0);

    this.killsText = this.add
      .text(GAME_WIDTH - 82, 90, "", {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "15px",
        fontStyle: "700"
      })
      .setOrigin(1, 0);
    this.updateCombatHud();

    this.timerText = this.add
      .text(GAME_WIDTH - 82, 112, "", {
        color: Palette.mutedText,
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        fontStyle: "700"
      })
      .setOrigin(1, 0);
    this.updateTimerHud();

    this.safeZoneText = this.add
      .text(GAME_WIDTH - 82, 132, "", {
        color: "#fef3c7",
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        fontStyle: "700"
      })
      .setOrigin(1, 0);

    this.statusText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 30, this.defaultStatusText, {
        color: Palette.mutedText,
        fontFamily: "Arial, sans-serif",
        fontSize: "15px"
      })
      .setOrigin(0.5);
  }

  private createPauseButton(): void {
    const background = this.add
      .rectangle(0, 0, 88, 30, Palette.panel, 0.92)
      .setStrokeStyle(2, Palette.panelLight, 1)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(0, 0, "Pause", {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "15px",
        fontStyle: "800"
      })
      .setOrigin(0.5);

    background.on("pointerover", () => background.setFillStyle(Palette.panelLight, 1));
    background.on("pointerout", () => background.setFillStyle(Palette.panel, 0.92));
    background.on("pointerdown", () => {
      sfxSystem.play("ui");
      this.pauseMatch("manual");
    });

    this.add.container(GAME_WIDTH - 118, 24, [background, label]).setDepth(35);
  }

  private handlePauseKey(): void {
    this.togglePause("manual");
  }

  private togglePause(reason: "manual" | "system"): void {
    if (this.matchPaused) {
      this.resumeMatch();
      return;
    }

    this.pauseMatch(reason);
  }

  private pauseMatch(reason: "manual" | "system"): void {
    if (this.matchPaused || this.matchFinalized || !this.playerAlive) {
      return;
    }

    this.matchPaused = true;
    this.pauseReason = reason;
    this.pauseStartedAt = this.getNow();
    this.input.setDefaultCursor("default");
    this.touchControls?.cancelActiveInput();
    this.pickupPromptText?.setText("");
    this.countdownTimers.forEach((timer) => {
      timer.paused = true;
    });
    this.createPauseOverlay(reason);
    sfxSystem.play("ui");
  }

  private resumeMatch(): void {
    if (!this.matchPaused) {
      return;
    }

    const pausedFor = Math.max(0, this.getNow() - this.pauseStartedAt);
    this.matchStartAt += pausedFor;
    this.countdownEndsAt += pausedFor;
    this.battleBeginEndsAt = this.shiftTimestamp(this.battleBeginEndsAt, pausedFor);
    this.lastShotAt = this.shiftTimestamp(this.lastShotAt, pausedFor);
    this.lastZoneWarningAt = this.shiftTimestamp(this.lastZoneWarningAt, pausedFor);
    this.lastZoneDamageTickAt = this.shiftTimestamp(this.lastZoneDamageTickAt, pausedFor);
    this.nextRechargeSpawnAt = this.shiftTimestamp(this.nextRechargeSpawnAt, pausedFor);
    this.enemyLoadouts.forEach((loadout) => {
      loadout.lastShotAt = this.shiftTimestamp(loadout.lastShotAt, pausedFor);
    });
    this.countdownTimers.forEach((timer) => {
      timer.paused = false;
    });

    this.matchPaused = false;
    this.pauseStartedAt = 0;
    this.input.setDefaultCursor("crosshair");
    this.pauseOverlay?.destroy(true);
    this.pauseOverlay = undefined;
    sfxSystem.play("ui");
  }

  private createPauseOverlay(reason: "manual" | "system"): void {
    this.pauseOverlay?.destroy(true);

    const overlay = this.add.container(0, 0).setDepth(80);
    const blocker = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x020617, 0.72).setOrigin(0).setInteractive();
    const panel = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 360, 286, Palette.panel, 1)
      .setStrokeStyle(2, Palette.panelLight, 1);
    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 92, "Paused", {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "42px",
        fontStyle: "900"
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 48, reason === "system" ? "Match held while away." : "Match held.", {
        color: Palette.mutedText,
        fontFamily: "Arial, sans-serif",
        fontSize: "17px",
        fontStyle: "700"
      })
      .setOrigin(0.5);
    const resumeButton = createTextButton(this, {
      label: "Resume",
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 14,
      width: 220,
      height: 48,
      onClick: () => this.resumeMatch()
    });
    const restartButton = createTextButton(this, {
      label: "Restart",
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 72,
      width: 220,
      height: 48,
      onClick: () => this.scene.restart()
    });
    const menuButton = createTextButton(this, {
      label: "Menu",
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 130,
      width: 220,
      height: 48,
      onClick: () => this.scene.start(SceneKeys.Menu)
    });

    overlay.add([blocker, panel, title, subtitle, resumeButton, restartButton, menuButton]);
    this.pauseOverlay = overlay;
  }

  private shiftTimestamp(value: number, delta: number): number {
    return Number.isFinite(value) ? value + delta : value;
  }

  private registerLifecycleHandlers(): void {
    document.addEventListener("visibilitychange", this.handleDocumentVisibilityChange);
    window.addEventListener("blur", this.handleWindowBlur);

    if (!this.playablesLifecycleRegistered) {
      playablesBridge.onPause(this.handlePlayablesPause);
      playablesBridge.onResume(this.handlePlayablesResume);
      this.playablesLifecycleRegistered = true;
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupLifecycleHandlers, this);
  }

  private cleanupLifecycleHandlers(): void {
    document.removeEventListener("visibilitychange", this.handleDocumentVisibilityChange);
    window.removeEventListener("blur", this.handleWindowBlur);
    this.input.keyboard?.off("keydown-ESC", this.handlePauseKey, this);
    this.input.keyboard?.off("keydown-P", this.handlePauseKey, this);
    this.multiplayerUnsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());
    this.multiplayerBulletSprites.forEach((sprite) => sprite.destroy());
    this.multiplayerBulletSprites.clear();
    this.multiplayerRemoteTargets.clear();

    if (this.multiplayerClient && !this.multiplayerMatchEnded) {
      this.multiplayerClient.close();
    }

    this.pauseOverlay?.destroy(true);
    this.pauseOverlay = undefined;
    this.matchPaused = false;
  }

  private getMovementInput(): MovementInput {
    const left = Boolean(this.cursorKeys?.left.isDown || this.movementKeys?.left.isDown);
    const right = Boolean(this.cursorKeys?.right.isDown || this.movementKeys?.right.isDown);
    const up = Boolean(this.cursorKeys?.up.isDown || this.movementKeys?.up.isDown);
    const down = Boolean(this.cursorKeys?.down.isDown || this.movementKeys?.down.isDown);
    const touchMovement = this.touchControls?.movement ?? { x: 0, y: 0 };

    return {
      x: Phaser.Math.Clamp(Number(right) - Number(left) + touchMovement.x, -1, 1),
      y: Phaser.Math.Clamp(Number(down) - Number(up) + touchMovement.y, -1, 1)
    };
  }

  private isFireInputDown(): boolean {
    const pointer = this.input.activePointer;
    const pointerWantsToShoot = pointer.isDown && !this.touchControls?.isControlPointer(pointer);
    const keyboardWantsToShoot = Boolean(this.actionKeys?.fire.isDown);
    const touchWantsToShoot = Boolean(this.touchControls?.fireDown);

    return pointerWantsToShoot || keyboardWantsToShoot || touchWantsToShoot;
  }

  private sendMultiplayerInput(time: number): void {
    if (!this.multiplayerClient || !this.player || time - this.lastMultiplayerInputAt < 50) {
      return;
    }

    this.lastMultiplayerInputAt = time;
    const movementInput = this.playerAlive ? this.getMovementInput() : { x: 0, y: 0 };
    this.multiplayerClient.sendInput({
      moveX: movementInput.x,
      moveY: movementInput.y,
      aimAngle: this.player.getAimAngle(),
      fire: this.matchActive && this.playerAlive && this.isFireInputDown()
    });
  }

  private handleShooting(time: number): void {
    const weapon = this.activeWeapon;
    const wantsToShoot = this.isFireInputDown();

    if (!this.matchActive || !wantsToShoot || !this.player || !this.playerAlive) {
      return;
    }

    if (time - this.lastShotAt < weapon.fireCooldownMs) {
      return;
    }

    this.lastShotAt = time;

    if (this.activeAmmo <= 0) {
      sfxSystem.play("empty");
      this.showStatus(`${weapon.name} is out of ammo. Pickups and recharge items matter.`, Palette.warning);
      return;
    }

    const ammoPreserved = this.shouldPreserveAmmo();

    if (!ammoPreserved) {
      this.inventoryAmmo[this.activeWeaponId] -= 1;
    }

    this.tutorialFired = true;
    this.fireWeapon(weapon);
    this.updateWeaponHud();

    if (ammoPreserved) {
      this.showStatus("Ammo efficiency preserved a round.", Palette.accent, 600);
    }
  }

  private shouldPreserveAmmo(): boolean {
    const preserveChance = getAmmoPreserveChance(this.ammoEfficiencyLevel);
    return preserveChance > 0 && Phaser.Math.FloatBetween(0, 1) < preserveChance;
  }

  private fireWeapon(weapon: WeaponDefinition): void {
    if (!this.player) {
      return;
    }

    const muzzle = this.player.getMuzzlePosition();
    const baseAngle = this.player.getAimAngle();

    for (let pelletIndex = 0; pelletIndex < weapon.pellets; pelletIndex += 1) {
      const pelletAngle = this.getPelletAngle(baseAngle, weapon, pelletIndex);

      this.bullets.push(
        new Bullet(this, {
          x: muzzle.x,
          y: muzzle.y,
          angle: pelletAngle,
          speed: weapon.bulletSpeed,
          range: weapon.range,
          damage: weapon.damage,
          radius: weapon.bulletRadius,
          color: weapon.bulletColor,
          owner: "player"
        })
      );
    }

    this.showMuzzleFlash(muzzle.x, muzzle.y);
    sfxSystem.play(weapon.pellets > 1 ? "shootHeavy" : "shoot");
  }

  private getPelletAngle(baseAngle: number, weapon: WeaponDefinition, pelletIndex: number): number {
    if (weapon.pellets <= 1) {
      return baseAngle + Phaser.Math.FloatBetween(-weapon.spreadRadians, weapon.spreadRadians);
    }

    const start = -weapon.spreadRadians / 2;
    const step = weapon.spreadRadians / Math.max(1, weapon.pellets - 1);
    return baseAngle + start + step * pelletIndex;
  }

  private updateBullets(delta: number): void {
    for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.bullets[index];

      if (!bullet.update(delta, ARENA_BOUNDS)) {
        this.bullets.splice(index, 1);
        continue;
      }

      const hitSomething = bullet.owner === "player" ? this.handlePlayerBulletHit(bullet) : this.handleBotBulletHit(bullet);

      if (hitSomething) {
        bullet.destroy();
        this.bullets.splice(index, 1);
      }
    }
  }

  private applySafeZoneDamage(_delta: number): void {
    const now = this.getNow();

    if (now - this.lastZoneDamageTickAt < 650) {
      return;
    }

    this.lastZoneDamageTickAt = now;
    const tickSeconds = 0.65;

    if (this.player && this.playerAlive && !this.isInsideSafeZone(this.player.x, this.player.y)) {
      this.applyZoneDamageToPlayer(OUTSIDE_ZONE_DAMAGE_PER_SECOND * tickSeconds);
    }

    this.enemies.forEach((enemy) => {
      if (!enemy.isAlive || this.isInsideSafeZone(enemy.x, enemy.y)) {
        return;
      }

      const result = enemy.takeDamage(BOT_OUTSIDE_ZONE_DAMAGE_PER_SECOND * tickSeconds);

      if (result.killed) {
        this.recordEnemyEliminated(enemy);
        this.dropEnemyLoot(enemy);
        sfxSystem.play("explosion", 0.85);
        this.showStatus(`A rival was lost outside the safe zone. ${this.getAliveEnemyCount()} remaining.`, Palette.warning);

        if (this.getAliveEnemyCount() === 0) {
          this.finalizeMatch(true, "victory");
        }
      }
    });
  }

  private applyZoneDamageToPlayer(amount: number): void {
    const shieldBefore = this.playerShield;
    this.playerShield = Math.max(0, this.playerShield - amount);
    const absorbedByShield = shieldBefore - this.playerShield;
    const remainingDamage = amount - absorbedByShield;
    const healthBefore = this.playerHealth;
    this.playerHealth = Math.max(0, this.playerHealth - remainingDamage);
    const dealtToHealth = healthBefore - this.playerHealth;
    const appliedDamage = Math.max(1, Math.round(absorbedByShield + dealtToHealth));

    this.updatePlayerHud();
    this.showPlayerDamageText(appliedDamage);
    sfxSystem.play("zone", 0.75);

    if (this.playerHealth <= 0) {
      this.playerAlive = false;
      this.input.setDefaultCursor("default");
      this.pickupPromptText?.setText("");
      sfxSystem.play("explosion", 1);
      this.finalizeMatch(false, "eliminated");
      return;
    }

    if (this.getNow() - this.lastZoneWarningAt > 1800) {
      this.lastZoneWarningAt = this.getNow();
      this.showStatus("Outside safe zone. Move inside the blue circle.", Palette.warning, 1300);
    }
  }

  private isInsideSafeZone(x: number, y: number, margin = 0): boolean {
    return Phaser.Math.Distance.Between(x, y, SAFE_ZONE_CENTER.x, SAFE_ZONE_CENTER.y) <= this.safeZoneRadius - margin;
  }

  private updateAmmoHud(): void {
    this.updateWeaponHud();
  }

  private updateWeaponHud(): void {
    if (this.isMultiplayerMatch()) {
      this.weaponText?.setText(
        `Weapon: Pistol   Ammo: Online   Armor: ${this.armorShards}   Coins: ${this.coinShards}   HP ${Math.round(this.playerHealth)}/${this.playerMaxHealth}   SH ${Math.round(this.playerShield)}/${this.playerMaxShield}`
      );
      return;
    }

    this.weaponText?.setText(
      `Weapon: ${this.activeWeapon.name}   Ammo: ${this.activeAmmo}/${this.activeWeapon.ammoCapacity}   Armor: ${this.armorShards}   Coins: ${this.coinShards}   HP ${Math.round(this.playerHealth)}/${this.playerMaxHealth}   SH ${Math.round(this.playerShield)}/${this.playerMaxShield}`
    );
  }

  private updateCombatHud(): void {
    this.scoreText?.setText(`Score: ${this.score}`);
    this.killsText?.setText(`Kills: ${this.kills}`);
  }

  private updateTimerHud(): void {
    this.timerText?.setText(`Time: ${this.getSurvivalSeconds()}s`);
  }

  private updateSoundHud(): void {
    this.soundText?.setText(sfxSystem.isMuted ? "M: Sound Off" : "M: Sound On");
  }

  private toggleSound(): void {
    const muted = sfxSystem.toggleMuted();
    this.updateSoundHud();
    this.showStatus(muted ? "Sound muted." : "Sound on.", muted ? Palette.warning : Palette.accent);
  }

  private updatePlayerHud(): void {
    const healthRatio = Phaser.Math.Clamp(this.playerHealth / this.playerMaxHealth, 0, 1);
    const shieldRatio = Phaser.Math.Clamp(this.playerShield / this.playerMaxShield, 0, 1);

    this.updateWeaponHud();
    this.healthBarFill?.setScale(healthRatio, 1);
    this.shieldBarFill?.setScale(shieldRatio, 1);
    this.player?.setShieldRatio(shieldRatio);
  }

  private syncMultiplayerSnapshot(delta: number): void {
    const snapshot = this.multiplayerClient?.lastSnapshot;
    const localId = this.multiplayerClient?.playerId;

    if (!snapshot || !localId) {
      return;
    }

    const localPlayer = snapshot.players.find((player) => player.id === localId);

    if (localPlayer) {
      this.playerAlive = localPlayer.alive;
      this.playerHealth = localPlayer.health;
      this.playerMaxHealth = localPlayer.maxHealth;
      this.playerShield = localPlayer.shield;
      this.playerMaxShield = localPlayer.maxShield;
      this.score = localPlayer.score;
      this.kills = localPlayer.kills;
      this.safeZoneRadius = snapshot.safeZoneRadius;

      if (this.player && localPlayer.alive) {
        this.player.syncNetworkState({
          x: localPlayer.x,
          y: localPlayer.y,
          aimAngle: localPlayer.aimAngle,
          moveX: localPlayer.moveX,
          moveY: localPlayer.moveY,
          deltaMs: delta,
          bounds: ARENA_BOUNDS
        });
      }
    }

    snapshot.players
      .filter((remotePlayer) => remotePlayer.id !== localId)
      .forEach((remotePlayer) => {
        let target = this.multiplayerRemoteTargets.get(remotePlayer.id);

        if (!target) {
          target = new EnemyTarget(this, {
            x: remotePlayer.x,
            y: remotePlayer.y,
            name: remotePlayer.name,
            color: remotePlayer.color,
            maxHealth: remotePlayer.maxHealth,
            maxShield: remotePlayer.maxShield
          });
          this.multiplayerRemoteTargets.set(remotePlayer.id, target);
        }

        target.syncNetworkState({
          x: remotePlayer.x,
          y: remotePlayer.y,
          aimAngle: remotePlayer.aimAngle,
          moveX: remotePlayer.moveX,
          moveY: remotePlayer.moveY,
          healthRatio: remotePlayer.maxHealth > 0 ? remotePlayer.health / remotePlayer.maxHealth : 0,
          shieldRatio: remotePlayer.maxShield > 0 ? remotePlayer.shield / remotePlayer.maxShield : 0,
          alive: remotePlayer.alive,
          deltaMs: delta
        });
      });

    this.syncMultiplayerBullets(snapshot);
    this.updatePlayerHud();
    this.updateCombatHud();
  }

  private syncMultiplayerBullets(snapshot: MultiplayerSnapshot): void {
    const activeBulletIds = new Set(snapshot.bullets.map((bullet) => bullet.id));

    this.multiplayerBulletSprites.forEach((sprite, bulletId) => {
      if (!activeBulletIds.has(bulletId)) {
        sprite.destroy();
        this.multiplayerBulletSprites.delete(bulletId);
      }
    });

    snapshot.bullets.forEach((bullet) => {
      let sprite = this.multiplayerBulletSprites.get(bullet.id);

      if (!sprite) {
        sprite = this.add.circle(bullet.x, bullet.y, bullet.radius, bullet.color, 1);
        sprite.setStrokeStyle(1, 0xffffff, 0.35);
        sprite.setDepth(8);
        this.multiplayerBulletSprites.set(bullet.id, sprite);
        return;
      }

      sprite.setPosition(bullet.x, bullet.y);
    });
  }

  private handlePlayerBulletHit(bullet: Bullet): boolean {
    for (const enemy of this.enemies) {
      if (!enemy.isHitBy(bullet.x, bullet.y, bullet.collisionRadius)) {
        continue;
      }

      const result = enemy.takeDamage(bullet.damage);
      this.damageDealt += result.totalApplied;
      this.score += Math.round(result.totalApplied * DAMAGE_SCORE_MULTIPLIER);

      if (result.killed) {
        this.kills += 1;
        this.score += KILL_SCORE_BONUS;
        this.recordEnemyEliminated(enemy);
        this.dropEnemyLoot(enemy);
        sfxSystem.play("explosion");
        this.showStatus(`Eliminated target. ${this.getAliveEnemyCount()} remaining.`, Palette.accent);
      } else {
        sfxSystem.play("hit");
      }

      if (this.getAliveEnemyCount() === 0) {
        this.finalizeMatch(true, "victory");
      }

      this.updateCombatHud();
      return true;
    }

    return false;
  }

  private handleBotBulletHit(bullet: Bullet): boolean {
    for (const enemy of this.enemies) {
      if (enemy === bullet.sourceEnemy || !enemy.isHitBy(bullet.x, bullet.y, bullet.collisionRadius)) {
        continue;
      }

      this.applyBotDamageToEnemy(enemy, bullet.damage, bullet.sourceEnemy);
      return true;
    }

    const hitPlayer =
      this.player &&
      this.playerAlive &&
      Phaser.Math.Distance.Between(this.player.x, this.player.y, bullet.x, bullet.y) <= 18 + bullet.collisionRadius;

    if (!hitPlayer) {
      return false;
    }

    this.applyDamageToPlayer(bullet.damage, bullet.sourceEnemy);
    return true;
  }

  private applyBotDamageToEnemy(enemy: EnemyTarget, damage: number, sourceEnemy?: EnemyTarget): void {
    const result = enemy.takeDamage(damage);
    this.addEnemyScore(sourceEnemy, Math.round(result.totalApplied * DAMAGE_SCORE_MULTIPLIER));

    if (result.killed) {
      this.addEnemyScore(sourceEnemy, KILL_SCORE_BONUS);
      this.recordEnemyEliminated(enemy);
      this.dropEnemyLoot(enemy);
      sfxSystem.play("explosion", 0.85);
      this.showStatus(`A rival eliminated another rival. ${this.getAliveEnemyCount()} remaining.`, Palette.warning);

      if (this.getAliveEnemyCount() === 0) {
        this.finalizeMatch(true, "victory");
      }
      return;
    }

    sfxSystem.play("hit", 0.55);
  }

  private updateBots(time: number, delta: number): void {
    if (!this.player || !this.playerAlive) {
      return;
    }

    this.enemies.forEach((enemy) => {
      if (!enemy.isAlive) {
        return;
      }

      const loadout = this.enemyLoadouts.get(enemy);

      if (!loadout) {
        return;
      }

      const combatTarget = this.findNearestCombatTarget(enemy);

      if (!combatTarget) {
        return;
      }

      const movementState = this.getBotMovementState(enemy, time);
      const isUnsticking = movementState.unstuckUntil > time;

      if (isUnsticking && Phaser.Math.Distance.Between(enemy.x, enemy.y, movementState.unstuckX, movementState.unstuckY) > 34) {
        enemy.aimAt(combatTarget.x, combatTarget.y);
        enemy.moveToward(delta, movementState.unstuckX, movementState.unstuckY, ARENA_BOUNDS, 1.35);
        this.collectNearbyBotPickups(enemy, loadout);
        this.tryBotShoot(enemy, time, combatTarget);
        this.updateBotMovementState(enemy, time);
        return;
      }

      if (isUnsticking) {
        movementState.unstuckUntil = Number.NEGATIVE_INFINITY;
      }

      const objective = this.getBotObjective(enemy, loadout, combatTarget);
      enemy.aimAt(combatTarget.x, combatTarget.y);

      switch (objective.kind) {
        case "flee":
          enemy.moveAwayFrom(delta, objective.x, objective.y, ARENA_BOUNDS, 1.35);
          break;
        case "separate":
          enemy.moveAwayFrom(delta, objective.x, objective.y, ARENA_BOUNDS, 0.9);
          break;
        case "safeZone":
          enemy.moveToward(delta, objective.x, objective.y, ARENA_BOUNDS, 1.22);
          break;
        case "weapon":
        case "recharge":
        case "loot":
          enemy.moveToward(delta, objective.x, objective.y, ARENA_BOUNDS, enemy.healthRatio < 0.35 ? 1.22 : 1.05);
          break;
        case "combat":
          enemy.updateBot(delta, combatTarget.x, combatTarget.y, ARENA_BOUNDS);
          break;
      }

      this.collectNearbyBotPickups(enemy, loadout);

      if (objective.kind !== "flee") {
        this.tryBotShoot(enemy, time, combatTarget);
      }

      this.updateBotMovementState(enemy, time);
    });
  }

  private getBotObjective(enemy: EnemyTarget, loadout: EnemyLoadout, combatTarget: BotCombatTarget): BotObjective {
    const distanceToTarget = Phaser.Math.Distance.Between(enemy.x, enemy.y, combatTarget.x, combatTarget.y);
    const distanceToSafeCenter = Phaser.Math.Distance.Between(enemy.x, enemy.y, SAFE_ZONE_CENTER.x, SAFE_ZONE_CENTER.y);
    const unsafeDistance = this.safeZoneRadius < 440 ? this.safeZoneRadius - 28 : this.safeZoneRadius;
    const shouldSeekSafeZone = distanceToSafeCenter > unsafeDistance;
    const lowHealth = enemy.healthRatio < 0.52;
    const lowShield = enemy.shieldRatio < 0.34;
    const lowSurvival = enemy.healthRatio < 0.36 || enemy.shieldRatio < 0.22;
    const nearArenaEdge = this.isNearArenaEdge(enemy.x, enemy.y, 54);
    const currentWeapon = WEAPON_DEFINITIONS[loadout.weaponId];
    const lowAmmo = loadout.ammo <= Math.max(2, Math.floor(currentWeapon.ammoCapacity * 0.22));
    const nearbyRecharge = this.findNearestRechargeForBot(
      enemy,
      lowSurvival || lowAmmo ? 520 : 260,
      lowHealth || lowSurvival,
      lowShield || lowSurvival,
      lowAmmo
    );
    const nearbyRival = this.findNearbyRivalForSeparation(enemy, this.safeZoneRadius < 150 ? 58 : 46);

    if (shouldSeekSafeZone) {
      return { kind: "safeZone", ...this.getBotSafeZonePoint(enemy) };
    }

    if (nearbyRival) {
      return { kind: "separate", ...nearbyRival };
    }

    if (nearbyRecharge) {
      return { kind: "recharge", ...nearbyRecharge };
    }

    if (lowSurvival && nearArenaEdge) {
      return { kind: "safeZone", ...this.getBotSafeZonePoint(enemy) };
    }

    if (lowSurvival && distanceToTarget < enemy.preferredCombatRange * 1.25) {
      return { kind: "flee", x: combatTarget.x, y: combatTarget.y };
    }

    const nearbyWeapon = this.findNearestWeaponForBot(enemy, loadout, lowAmmo ? 560 : 320);

    if (nearbyWeapon) {
      return { kind: "weapon", ...nearbyWeapon };
    }

    const nearbyLoot = this.findNearestLootForBot(enemy, lowSurvival ? 360 : 190);

    if (nearbyLoot) {
      return { kind: "loot", ...nearbyLoot };
    }

    return { kind: "combat" };
  }

  private isNearArenaEdge(x: number, y: number, margin: number): boolean {
    return (
      x < ARENA_BOUNDS.x + margin ||
      x > ARENA_BOUNDS.x + ARENA_BOUNDS.width - margin ||
      y < ARENA_BOUNDS.y + margin ||
      y > ARENA_BOUNDS.y + ARENA_BOUNDS.height - margin
    );
  }

  private getBotSafeZonePoint(enemy: EnemyTarget): { x: number; y: number } {
    const livingEnemies = this.enemies.filter((candidate) => candidate.isAlive);
    const index = Math.max(0, livingEnemies.indexOf(enemy));
    const count = Math.max(1, livingEnemies.length);
    const orbitRadius = Phaser.Math.Clamp(this.safeZoneRadius * 0.42, 26, 74);
    const orbitAngle = -Math.PI / 2 + (index / count) * Math.PI * 2;

    return {
      x: Phaser.Math.Clamp(
        SAFE_ZONE_CENTER.x + Math.cos(orbitAngle) * orbitRadius,
        ARENA_BOUNDS.x + enemy.collisionRadius,
        ARENA_BOUNDS.x + ARENA_BOUNDS.width - enemy.collisionRadius
      ),
      y: Phaser.Math.Clamp(
        SAFE_ZONE_CENTER.y + Math.sin(orbitAngle) * orbitRadius,
        ARENA_BOUNDS.y + enemy.collisionRadius,
        ARENA_BOUNDS.y + ARENA_BOUNDS.height - enemy.collisionRadius
      )
    };
  }

  private findNearbyRivalForSeparation(enemy: EnemyTarget, minDistance: number): { x: number; y: number } | null {
    let nearestX = 0;
    let nearestY = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of this.enemies) {
      if (candidate === enemy || !candidate.isAlive) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, candidate.x, candidate.y);

      if (distance > minDistance || distance >= nearestDistance) {
        continue;
      }

      nearestX = candidate.x;
      nearestY = candidate.y;
      nearestDistance = distance;
    }

    return Number.isFinite(nearestDistance) ? { x: nearestX, y: nearestY } : null;
  }

  private findNearestCombatTarget(enemy: EnemyTarget): BotCombatTarget | null {
    const candidates: Array<BotCombatTarget & { effectiveDistance: number }> = [];
    const livingRivalCount = this.enemies.filter((candidate) => candidate !== enemy && candidate.isAlive).length;
    const playerTargetPenalty =
      livingRivalCount > 0
        ? BOT_PLAYER_TARGET_DISTANCE_PENALTY + (this.getSurvivalSeconds() < 10 ? BOT_PLAYER_OPENING_TARGET_PENALTY : 0)
        : 0;

    if (this.player && this.playerAlive) {
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);

      candidates.push({
        x: this.player.x,
        y: this.player.y,
        kind: "player",
        effectiveDistance: distance + playerTargetPenalty
      });
    }

    this.enemies.forEach((candidate) => {
      if (candidate === enemy || !candidate.isAlive) {
        return;
      }

      candidates.push({
        x: candidate.x,
        y: candidate.y,
        kind: "rival",
        effectiveDistance: Phaser.Math.Distance.Between(enemy.x, enemy.y, candidate.x, candidate.y)
      });
    });

    candidates.sort((a, b) => a.effectiveDistance - b.effectiveDistance);

    if (!candidates[0]) {
      return null;
    }

    return {
      x: candidates[0].x,
      y: candidates[0].y,
      kind: candidates[0].kind
    };
  }

  private getBotMovementState(enemy: EnemyTarget, time: number): BotMovementState {
    const existing = this.botMovementStates.get(enemy);

    if (existing) {
      return existing;
    }

    const state: BotMovementState = {
      sampleX: enemy.x,
      sampleY: enemy.y,
      sampleAt: time,
      stuckStartedAt: Number.NEGATIVE_INFINITY,
      unstuckUntil: Number.NEGATIVE_INFINITY,
      unstuckX: SAFE_ZONE_CENTER.x,
      unstuckY: SAFE_ZONE_CENTER.y
    };
    this.botMovementStates.set(enemy, state);
    return state;
  }

  private updateBotMovementState(enemy: EnemyTarget, time: number): void {
    const state = this.getBotMovementState(enemy, time);

    if (time - state.sampleAt < 520) {
      return;
    }

    const movedDistance = Phaser.Math.Distance.Between(state.sampleX, state.sampleY, enemy.x, enemy.y);

    if (movedDistance >= 5) {
      state.sampleX = enemy.x;
      state.sampleY = enemy.y;
      state.sampleAt = time;
      state.stuckStartedAt = Number.NEGATIVE_INFINITY;
      return;
    }

    if (!Number.isFinite(state.stuckStartedAt)) {
      state.stuckStartedAt = time;
      state.sampleAt = time;
      return;
    }

    if (time - state.stuckStartedAt < 900) {
      state.sampleAt = time;
      return;
    }

    const unstickPoint = this.findBotUnstickPoint(enemy);
    state.unstuckUntil = time + 1500;
    state.unstuckX = unstickPoint.x;
    state.unstuckY = unstickPoint.y;
    state.sampleX = enemy.x;
    state.sampleY = enemy.y;
    state.sampleAt = time;
    state.stuckStartedAt = Number.NEGATIVE_INFINITY;
  }

  private findBotUnstickPoint(enemy: EnemyTarget): { x: number; y: number } {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const point = this.getRandomPointInsideSafeZone();

      if (Phaser.Math.Distance.Between(enemy.x, enemy.y, point.x, point.y) > 110) {
        return point;
      }
    }

    return this.getBotSafeZonePoint(enemy);
  }

  private collectNearbyBotPickups(enemy: EnemyTarget, loadout: EnemyLoadout): void {
    const rechargeIndex = this.rechargePickups.findIndex((pickup) => pickup.isInRange(enemy.x, enemy.y));

    if (rechargeIndex !== -1) {
      this.collectBotRecharge(enemy, loadout, rechargeIndex);
      return;
    }

    const weaponIndex = this.weaponPickups.findIndex((pickup) => pickup.isInRange(enemy.x, enemy.y));

    if (weaponIndex !== -1) {
      this.collectBotWeapon(enemy, loadout, weaponIndex);
      return;
    }

    const lootIndex = this.lootDrops.findIndex((drop) => drop.isInRange(enemy.x, enemy.y));

    if (lootIndex !== -1) {
      this.collectBotLoot(enemy, lootIndex);
    }
  }

  private collectBotRecharge(enemy: EnemyTarget, loadout: EnemyLoadout, pickupIndex: number): void {
    const pickup = this.rechargePickups[pickupIndex];
    const weapon = WEAPON_DEFINITIONS[loadout.weaponId];
    const ammoBefore = loadout.ammo;

    const restoredHealth = enemy.restoreHealth(pickup.healthAmount);
    const restoredShield = enemy.restoreShield(pickup.shieldAmount);
    loadout.ammo = Phaser.Math.Clamp(loadout.ammo + pickup.ammoAmount, 0, weapon.ammoCapacity);
    const restoredAmmo = loadout.ammo - ammoBefore;
    this.addEnemyScore(enemy, restoredHealth + restoredShield + restoredAmmo);

    const pickupX = pickup.x;
    const pickupY = pickup.y;
    pickup.collect();
    this.rechargePickups.splice(pickupIndex, 1);
    this.showPickupBurst(pickupX, pickupY, this.getRechargeBurstColor(pickup.type));
  }

  private collectBotWeapon(enemy: EnemyTarget, loadout: EnemyLoadout, pickupIndex: number): void {
    const pickup = this.weaponPickups[pickupIndex];
    const currentRank = WEAPON_RANK[loadout.weaponId];
    const pickupRank = WEAPON_RANK[pickup.weapon.id];
    const shouldSwitch = pickupRank >= currentRank || loadout.ammo <= 2;

    if (shouldSwitch) {
      loadout.weaponId = pickup.weapon.id;
      loadout.ammo = Phaser.Math.Clamp(pickup.ammo, 0, pickup.weapon.ammoCapacity);
    } else {
      const currentWeapon = WEAPON_DEFINITIONS[loadout.weaponId];
      loadout.ammo = Phaser.Math.Clamp(loadout.ammo + Math.ceil(pickup.ammo * 0.35), 0, currentWeapon.ammoCapacity);
    }

    const pickupX = pickup.x;
    const pickupY = pickup.y;
    pickup.collect();
    this.weaponPickups.splice(pickupIndex, 1);
    this.addEnemyScore(enemy, WEAPON_PICKUP_SCORE);
    this.showPickupBurst(pickupX, pickupY, pickup.weapon.bulletColor);
  }

  private collectBotLoot(enemy: EnemyTarget, dropIndex: number): void {
    const drop = this.lootDrops[dropIndex];
    const dropX = drop.x;
    const dropY = drop.y;

    if (drop.type === "armor") {
      enemy.restoreShield(drop.amount * 8);
      this.addEnemyScore(enemy, drop.amount * 5);
    } else {
      this.addEnemyCoins(enemy, drop.amount);
      this.addEnemyScore(enemy, drop.amount * 2);
    }

    drop.collect();
    this.lootDrops.splice(dropIndex, 1);
    this.showPickupBurst(dropX, dropY, drop.type === "armor" ? 0x67e8f9 : 0xfacc15);
  }

  private findNearestWeaponForBot(
    enemy: EnemyTarget,
    loadout: EnemyLoadout,
    maxDistance: number
  ): { index: number; x: number; y: number } | null {
    const candidates: Array<{ index: number; x: number; y: number; distance: number }> = [];
    const currentRank = WEAPON_RANK[loadout.weaponId];

    this.weaponPickups.forEach((pickup, index) => {
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, pickup.x, pickup.y);
      const usefulWeapon = WEAPON_RANK[pickup.weapon.id] > currentRank || pickup.weapon.id === loadout.weaponId || loadout.ammo <= 2;

      if (!usefulWeapon || distance > maxDistance) {
        return;
      }

      candidates.push({ index, x: pickup.x, y: pickup.y, distance });
    });

    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0] ? { index: candidates[0].index, x: candidates[0].x, y: candidates[0].y } : null;
  }

  private findNearestRechargeForBot(
    enemy: EnemyTarget,
    maxDistance: number,
    needsHealth: boolean,
    needsShield: boolean,
    needsAmmo: boolean
  ): { index: number; x: number; y: number } | null {
    const candidates: Array<{ index: number; x: number; y: number; distance: number }> = [];

    this.rechargePickups.forEach((pickup, index) => {
      const usefulRecharge =
        (needsHealth && pickup.healthAmount > 0) ||
        (needsShield && pickup.shieldAmount > 0) ||
        (needsAmmo && pickup.ammoAmount > 0);
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, pickup.x, pickup.y);

      if (!usefulRecharge || distance > maxDistance) {
        return;
      }

      candidates.push({ index, x: pickup.x, y: pickup.y, distance });
    });

    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0] ? { index: candidates[0].index, x: candidates[0].x, y: candidates[0].y } : null;
  }

  private findNearestLootForBot(enemy: EnemyTarget, maxDistance: number): { index: number; x: number; y: number } | null {
    const candidates: Array<{ index: number; x: number; y: number; distance: number }> = [];

    this.lootDrops.forEach((drop, index) => {
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, drop.x, drop.y);

      if (distance > maxDistance) {
        return;
      }

      candidates.push({ index, x: drop.x, y: drop.y, distance });
    });

    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0] ? { index: candidates[0].index, x: candidates[0].x, y: candidates[0].y } : null;
  }

  private tryBotShoot(enemy: EnemyTarget, time: number, combatTarget: BotCombatTarget): void {
    const loadout = this.enemyLoadouts.get(enemy);

    if (!loadout || loadout.ammo <= 0) {
      return;
    }

    const weapon = WEAPON_DEFINITIONS[loadout.weaponId];
    const distanceToTarget = Phaser.Math.Distance.Between(enemy.x, enemy.y, combatTarget.x, combatTarget.y);
    const botCooldown = weapon.fireCooldownMs * BOT_FIRE_COOLDOWN_MULTIPLIER;

    if (distanceToTarget > weapon.range * 0.82 || time - loadout.lastShotAt < botCooldown) {
      return;
    }

    loadout.lastShotAt = time;
    loadout.ammo -= 1;
    this.fireBotWeapon(enemy, weapon);
  }

  private fireBotWeapon(enemy: EnemyTarget, weapon: WeaponDefinition): void {
    const muzzle = enemy.getMuzzlePosition();
    const baseAngle = enemy.getAimAngle();

    for (let pelletIndex = 0; pelletIndex < weapon.pellets; pelletIndex += 1) {
      const pelletAngle = this.getPelletAngle(baseAngle, weapon, pelletIndex);

      this.bullets.push(
        new Bullet(this, {
          x: muzzle.x,
          y: muzzle.y,
          angle: pelletAngle,
          speed: weapon.bulletSpeed * 0.88,
          range: weapon.range,
          damage: Math.max(4, Math.round(weapon.damage * BOT_DAMAGE_MULTIPLIER)),
          radius: weapon.bulletRadius,
          color: 0xffb4a8,
          owner: "bot",
          sourceEnemy: enemy
        })
      );
    }

    enemy.playShootPulse();
    this.showMuzzleFlash(muzzle.x, muzzle.y);
    sfxSystem.play("botShoot", 0.55);
  }

  private applyDamageToPlayer(amount: number, sourceEnemy?: EnemyTarget): void {
    const shieldBefore = this.playerShield;
    this.playerShield = Math.max(0, this.playerShield - amount);
    const absorbedByShield = shieldBefore - this.playerShield;
    const remainingDamage = amount - absorbedByShield;
    const healthBefore = this.playerHealth;
    this.playerHealth = Math.max(0, this.playerHealth - remainingDamage);
    const dealtToHealth = healthBefore - this.playerHealth;
    const appliedDamage = Math.round(absorbedByShield + dealtToHealth);
    this.addEnemyScore(sourceEnemy, Math.round(appliedDamage * DAMAGE_SCORE_MULTIPLIER));

    this.updatePlayerHud();
    this.showPlayerDamageText(appliedDamage);
    sfxSystem.play("playerHit");

    if (this.playerHealth <= 0) {
      this.playerAlive = false;
      this.input.setDefaultCursor("default");
      this.pickupPromptText?.setText("");
      this.addEnemyScore(sourceEnemy, KILL_SCORE_BONUS);
      sfxSystem.play("explosion", 1);
      this.finalizeMatch(false, "eliminated");
      return;
    }

    this.showStatus(`Hit for ${appliedDamage}. Shield absorbs damage first.`, Palette.warning);
  }

  private showPlayerDamageText(amount: number): void {
    if (!this.player || amount <= 0) {
      return;
    }

    const startY = Math.max(ARENA_BOUNDS.y + 26, this.player.y - 46);
    const endY = Math.max(ARENA_BOUNDS.y + 14, startY - 24);
    const damageText = this.add
      .text(this.player.x, startY, `-${amount}`, {
        color: "#fecaca",
        fontFamily: "Arial, sans-serif",
        fontSize: "17px",
        fontStyle: "800",
        stroke: "#0b1020",
        strokeThickness: 3
      })
      .setOrigin(0.5);

    this.player.playRechargePulse(0xef4444);
    this.tweens.add({
      targets: damageText,
      y: endY,
      alpha: 0,
      duration: 480,
      onComplete: () => damageText.destroy()
    });
  }

  private recordEnemyEliminated(enemy: EnemyTarget): void {
    const stats = this.enemyStandingStats.get(enemy);

    if (!stats || this.eliminatedEnemies.includes(enemy)) {
      return;
    }

    stats.eliminatedAt = this.getSurvivalSeconds();
    this.eliminatedEnemies.push(enemy);
  }

  private addEnemyScore(enemy: EnemyTarget | undefined, amount: number): void {
    if (!enemy || amount <= 0) {
      return;
    }

    const stats = this.enemyStandingStats.get(enemy);

    if (!stats) {
      return;
    }

    stats.score += Math.round(amount);
  }

  private addEnemyCoins(enemy: EnemyTarget | undefined, amount: number): void {
    if (!enemy || amount <= 0) {
      return;
    }

    const stats = this.enemyStandingStats.get(enemy);

    if (!stats) {
      return;
    }

    stats.coinShards += amount;
  }

  private buildStandings(playerScore: number, playerCoinsEarned: number, won: boolean): MatchStanding[] {
    const playerStanding: Omit<MatchStanding, "position"> = {
      name: this.playerDisplayName,
      score: playerScore,
      coinsEarned: playerCoinsEarned,
      eliminated: !won,
      isPlayer: true
    };
    const orderedStandings: Array<Omit<MatchStanding, "position">> = [
      playerStanding,
      ...this.enemies.map((enemy) => this.createEnemyStanding(enemy, enemy.isAlive))
    ].sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (a.eliminated !== b.eliminated) {
        return a.eliminated ? 1 : -1;
      }

      return a.name.localeCompare(b.name);
    });

    return orderedStandings.map((standing, index) => ({
      ...standing,
      position: index + 1
    }));
  }

  private createEnemyStanding(enemy: EnemyTarget, alive: boolean): Omit<MatchStanding, "position"> {
    const stats = this.enemyStandingStats.get(enemy);
    const survivalSeconds = alive ? this.getSurvivalSeconds() : stats?.eliminatedAt ?? this.getSurvivalSeconds();
    const lastSurvivorBonus = alive && this.getAliveEnemyCount() === 1 ? LAST_SURVIVOR_SCORE_BONUS : 0;
    const score = Math.round((stats?.score ?? 0) + survivalSeconds * SURVIVAL_SCORE_PER_SECOND + lastSurvivorBonus);

    return {
      name: stats?.name ?? "Rival",
      score,
      coinsEarned: Math.max(0, Math.floor(score / COIN_SCORE_DIVISOR) + (stats?.coinShards ?? 0)),
      eliminated: !alive
    };
  }

  private finalizeMultiplayerMatch(serverResult: MultiplayerMatchEnded): void {
    if (this.matchFinalized) {
      return;
    }

    const localId = this.multiplayerClient?.playerId;
    const localStanding = serverResult.standings.find((standing) => standing.id === localId);
    const won = Boolean(localStanding && !localStanding.eliminated && localStanding.position === 1);
    const finalScore = localStanding?.score ?? 0;
    const coinsEarned = localStanding?.coinsEarned ?? 0;
    const progress = saveSystem.loadProgress();
    const updatedProgress = {
      ...progress,
      coins: progress.coins + coinsEarned,
      totalMatches: progress.totalMatches + 1,
      totalWins: progress.totalWins + (won ? 1 : 0),
      bestScore: Math.max(progress.bestScore, finalScore)
    };
    const standings: MatchStanding[] = serverResult.standings.map((standing) => ({
      position: standing.position,
      name: standing.name,
      score: standing.score,
      coinsEarned: standing.coinsEarned,
      eliminated: standing.eliminated,
      isPlayer: standing.id === localId
    }));

    this.matchFinalized = true;
    this.multiplayerMatchEnded = true;
    this.playerAlive = false;
    this.input.setDefaultCursor("default");
    this.pickupPromptText?.setText("");
    saveSystem.saveProgress(updatedProgress);

    const result: MatchResultData = {
      won,
      reason: won ? "victory" : "eliminated",
      placement: localStanding?.position ?? standings.length,
      playerCount: standings.length,
      score: finalScore,
      baseScore: finalScore,
      survivalBonus: 0,
      winBonus: won ? LAST_SURVIVOR_SCORE_BONUS : 0,
      coinsEarned,
      totalCoins: updatedProgress.coins,
      kills: this.kills,
      damageDealt: Math.round(this.damageDealt),
      survivalSeconds: serverResult.survivalSeconds,
      armorShards: 0,
      coinShards: 0,
      bestScore: updatedProgress.bestScore,
      totalMatches: updatedProgress.totalMatches,
      totalWins: updatedProgress.totalWins,
      standings
    };

    this.showStatus(won ? "Victory. Calculating rewards..." : "Eliminated. Calculating rewards...", won ? Palette.accent : Palette.danger, 1200);
    this.time.delayedCall(1100, () => {
      this.multiplayerClient?.close();
      this.scene.start(SceneKeys.Results, result);
    });
  }

  private finalizeMatch(won: boolean, reason: MatchResultData["reason"]): void {
    if (this.matchFinalized) {
      return;
    }

    this.matchFinalized = true;
    this.playerAlive = false;
    this.input.setDefaultCursor("default");
    this.pickupPromptText?.setText("");
    this.tutorialGuide?.hide();

    const survivalSeconds = this.getSurvivalSeconds();
    const baseScore = this.score;
    const canEarnSurvivalBonus = baseScore > 0 || won;
    const survivalBonus = canEarnSurvivalBonus ? survivalSeconds * SURVIVAL_SCORE_PER_SECOND : 0;
    const winBonus = won ? LAST_SURVIVOR_SCORE_BONUS : 0;
    const finalScore = Math.round(baseScore + survivalBonus + winBonus);
    const coinsEarned = finalScore > 0 ? Math.max(0, Math.floor(finalScore / COIN_SCORE_DIVISOR) + this.coinShards) : 0;
    const standings = this.buildStandings(finalScore, coinsEarned, won);
    const placement = standings.find((standing) => standing.isPlayer)?.position ?? (won ? 1 : standings.length);
    const progress = saveSystem.loadProgress();
    const updatedProgress = {
      ...progress,
      coins: progress.coins + coinsEarned,
      totalMatches: progress.totalMatches + 1,
      totalWins: progress.totalWins + (won ? 1 : 0),
      bestScore: Math.max(progress.bestScore, finalScore)
    };
    saveSystem.saveProgress(updatedProgress);

    const result: MatchResultData = {
      won,
      reason,
      placement,
      playerCount: standings.length,
      score: finalScore,
      baseScore,
      survivalBonus,
      winBonus,
      coinsEarned,
      totalCoins: updatedProgress.coins,
      kills: this.kills,
      damageDealt: Math.round(this.damageDealt),
      survivalSeconds,
      armorShards: this.armorShards,
      coinShards: this.coinShards,
      bestScore: updatedProgress.bestScore,
      totalMatches: updatedProgress.totalMatches,
      totalWins: updatedProgress.totalWins,
      standings
    };

    this.showStatus(won ? "Victory. Calculating rewards..." : "Eliminated. Calculating rewards...", won ? Palette.accent : Palette.danger, 1500);
    this.time.delayedCall(1300, () => {
      this.scene.start(SceneKeys.Results, result);
    });
  }

  private getSurvivalSeconds(): number {
    return Math.max(0, Math.floor(this.getMatchElapsedSeconds()));
  }

  private getMatchElapsedSeconds(): number {
    const now = this.matchPaused ? this.pauseStartedAt : this.getNow();
    return Math.max(0, (now - this.matchStartAt) / 1000);
  }

  private getAliveEnemyCount(): number {
    return this.enemies.filter((enemy) => enemy.isAlive).length;
  }

  private handleWeaponControls(): void {
    if (!this.actionKeys) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.mute)) {
      this.toggleSound();
    }

    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.interact) || this.touchControls?.consumeInteractPress()) {
      this.pickupNearestInteractable();
    }

    if (this.touchControls?.consumeCyclePress()) {
      this.switchToNextCollectedWeapon();
    }

    const slotKeys = [this.actionKeys.slot1, this.actionKeys.slot2, this.actionKeys.slot3, this.actionKeys.slot4];
    slotKeys.forEach((key, index) => {
      if (Phaser.Input.Keyboard.JustDown(key)) {
        this.switchWeapon(WEAPON_SLOT_ORDER[index]);
      }
    });
  }

  private pickupNearestInteractable(): void {
    if (!this.player) {
      return;
    }

    const nearestWeapon = this.findNearestWeaponPickup();
    const nearestLoot = this.findNearestLootDrop();
    const nearestRecharge = this.findNearestRechargePickup();

    if (!nearestWeapon && !nearestLoot && !nearestRecharge) {
      this.showStatus("Move closer to a pickup.", Palette.warning);
      return;
    }

    const nearest = [
      nearestWeapon ? { kind: "weapon" as const, index: nearestWeapon.index, distance: nearestWeapon.distance } : null,
      nearestLoot ? { kind: "loot" as const, index: nearestLoot.index, distance: nearestLoot.distance } : null,
      nearestRecharge ? { kind: "recharge" as const, index: nearestRecharge.index, distance: nearestRecharge.distance } : null
    ]
      .filter((entry): entry is { kind: "weapon" | "loot" | "recharge"; index: number; distance: number } => entry !== null)
      .sort((a, b) => a.distance - b.distance)[0];

    if (nearest.kind === "weapon") {
      this.collectWeaponPickup(nearest.index);
      return;
    }

    if (nearest.kind === "loot") {
      this.collectLootDrop(nearest.index);
      return;
    }

    this.collectRechargePickup(nearest.index);
  }

  private collectWeaponPickup(pickupIndex: number): void {
    const pickup = this.weaponPickups[pickupIndex];

    const weaponId = pickup.weapon.id;
    const previousAmmo = this.inventoryAmmo[weaponId];
    const nextAmmo = Phaser.Math.Clamp(previousAmmo + pickup.ammo, 0, pickup.weapon.ammoCapacity);
    this.inventoryAmmo[weaponId] = nextAmmo;
    this.collectedWeapons.add(weaponId);
    this.tutorialCollected = true;
    this.tutorialCollectedWeapon = true;
    this.activeWeaponId = weaponId;
    this.lastShotAt = Number.NEGATIVE_INFINITY;
    this.score += WEAPON_PICKUP_SCORE;

    const pickupX = pickup.x;
    const pickupY = pickup.y;
    pickup.collect();
    this.weaponPickups.splice(pickupIndex, 1);
    this.updateWeaponHud();
    this.updateCombatHud();
    this.showPickupBurst(pickupX, pickupY, pickup.weapon.bulletColor);
    sfxSystem.play("pickup");
    this.showStatus(`Picked up ${pickup.weapon.name}.`, Palette.accent);
  }

  private switchWeapon(weaponId: WeaponId): void {
    if (!this.collectedWeapons.has(weaponId)) {
      this.showStatus(`${WEAPON_DEFINITIONS[weaponId].name} has not been collected yet.`, Palette.warning);
      return;
    }

    this.activeWeaponId = weaponId;
    this.tutorialSwitched = true;
    this.lastShotAt = Number.NEGATIVE_INFINITY;
    this.updateWeaponHud();
    sfxSystem.play("switch");
    this.showStatus(`Switched to ${this.activeWeapon.name}.`, Palette.accent);
  }

  private switchToNextCollectedWeapon(): void {
    const collectedWeapons = WEAPON_SLOT_ORDER.filter((weaponId) => this.collectedWeapons.has(weaponId));

    if (collectedWeapons.length <= 1) {
      sfxSystem.play("empty");
      this.showStatus("Pick up another weapon first.", Palette.warning);
      return;
    }

    const currentIndex = collectedWeapons.indexOf(this.activeWeaponId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % collectedWeapons.length;
    this.switchWeapon(collectedWeapons[nextIndex]);
  }

  private collectLootDrop(dropIndex: number): void {
    const drop = this.lootDrops[dropIndex];
    const dropX = drop.x;
    const dropY = drop.y;
    const color = drop.type === "armor" ? 0x67e8f9 : 0xfacc15;

    if (drop.type === "armor") {
      this.armorShards += drop.amount;
      this.score += drop.amount * 5;
      this.restoreShield(drop.amount * 8);
    } else {
      this.coinShards += drop.amount;
      this.score += drop.amount * 2;
    }

    this.tutorialCollected = true;
    drop.collect();
    this.lootDrops.splice(dropIndex, 1);
    this.updateLootHud();
    this.updateCombatHud();
    this.showPickupBurst(dropX, dropY, color);
    sfxSystem.play("pickup");
    this.showStatus(`Collected ${drop.amount} ${drop.type}.`, Palette.accent);
  }

  private collectRechargePickup(pickupIndex: number): void {
    const pickup = this.rechargePickups[pickupIndex];
    const pickupX = pickup.x;
    const pickupY = pickup.y;
    const restoredHealth = this.restoreHealth(pickup.healthAmount);
    const restoredShield = this.restoreShield(pickup.shieldAmount);
    const restoredAmmo = this.restoreActiveWeaponAmmo(pickup.ammoAmount);

    this.tutorialCollected = true;
    pickup.collect();
    this.rechargePickups.splice(pickupIndex, 1);
    this.score += restoredHealth + restoredShield + restoredAmmo;
    this.updatePlayerHud();
    this.updateWeaponHud();
    this.updateCombatHud();
    this.showPickupBurst(pickupX, pickupY, this.getRechargeBurstColor(pickup.type));
    sfxSystem.play("recharge");

    const effects: string[] = [];

    if (restoredHealth > 0) {
      effects.push(`health +${restoredHealth}`);
    }

    if (restoredShield > 0) {
      effects.push(`shield +${restoredShield}`);
    }

    if (restoredAmmo > 0) {
      effects.push(`${this.activeWeapon.name} ammo +${restoredAmmo}`);
    }

    this.showStatus(effects.length > 0 ? `Recharge: ${effects.join(", ")}.` : "Recharge already full.", Palette.accent);
  }

  private updatePickupHighlights(): void {
    if (!this.player) {
      return;
    }

    const prompts: Array<{ text: string; distance: number }> = [];

    this.weaponPickups.forEach((pickup) => {
      const inRange = pickup.isInRange(this.player!.x, this.player!.y);
      pickup.setInRange(inRange);

      if (inRange) {
        prompts.push({
          text: `Press E: ${pickup.weapon.name} +${pickup.ammo} ammo`,
          distance: Phaser.Math.Distance.Between(this.player!.x, this.player!.y, pickup.x, pickup.y)
        });
      }
    });

    this.lootDrops.forEach((drop) => {
      const inRange = drop.isInRange(this.player!.x, this.player!.y);
      drop.setInRange(inRange);

      if (inRange) {
        prompts.push({
          text: `Press E: ${drop.type} +${drop.amount}`,
          distance: Phaser.Math.Distance.Between(this.player!.x, this.player!.y, drop.x, drop.y)
        });
      }
    });

    this.rechargePickups.forEach((pickup) => {
      const inRange = pickup.isInRange(this.player!.x, this.player!.y);
      pickup.setInRange(inRange);

      if (inRange) {
        prompts.push({
          text: pickup.getPromptText(),
          distance: Phaser.Math.Distance.Between(this.player!.x, this.player!.y, pickup.x, pickup.y)
        });
      }
    });

    prompts.sort((a, b) => a.distance - b.distance);
    this.pickupPromptText?.setText(prompts[0]?.text ?? "");
  }

  private restoreHealth(amount: number): number {
    if (amount <= 0) {
      return 0;
    }

    const before = this.playerHealth;
    this.playerHealth = Phaser.Math.Clamp(this.playerHealth + amount, 0, this.playerMaxHealth);
    const restored = Math.round(this.playerHealth - before);

    if (restored > 0) {
      this.player?.playRechargePulse(0xfb7185);
      this.updatePlayerHud();
    }

    return restored;
  }

  private restoreShield(amount: number): number {
    if (amount <= 0) {
      return 0;
    }

    const before = this.playerShield;
    this.playerShield = Phaser.Math.Clamp(this.playerShield + amount, 0, this.playerMaxShield);
    const restored = Math.round(this.playerShield - before);

    if (restored > 0) {
      this.player?.playRechargePulse(0x67e8f9);
      this.updatePlayerHud();
    }

    return restored;
  }

  private restoreActiveWeaponAmmo(amount: number): number {
    if (amount <= 0) {
      return 0;
    }

    const weapon = this.activeWeapon;
    const before = this.inventoryAmmo[this.activeWeaponId];
    this.inventoryAmmo[this.activeWeaponId] = Phaser.Math.Clamp(before + amount, 0, weapon.ammoCapacity);
    return Math.round(this.inventoryAmmo[this.activeWeaponId] - before);
  }

  private updateRandomRechargePickups(time: number): void {
    if (!Number.isFinite(this.nextRechargeSpawnAt)) {
      this.scheduleNextRechargeSpawn(time);
      return;
    }

    if (time < this.nextRechargeSpawnAt) {
      return;
    }

    if (this.rechargePickups.length >= MAX_RECHARGE_PICKUPS) {
      this.nextRechargeSpawnAt = time + Phaser.Math.Between(2400, 4300);
      return;
    }

    this.spawnRechargePickupInsideZone(true);
    this.scheduleNextRechargeSpawn(time);
  }

  private scheduleNextRechargeSpawn(baseTime: number): void {
    this.nextRechargeSpawnAt = baseTime + Phaser.Math.Between(SUPPORT_PICKUP_SPAWN_MIN_MS, SUPPORT_PICKUP_SPAWN_MAX_MS);
  }

  private createRandomRechargeConfig(x: number, y: number): RechargePickupConfig {
    const type = this.pickRandomRechargeType();
    const activeWeaponCapacity = this.activeWeapon.ammoCapacity;
    const ammoAmount = Math.max(5, Math.round(activeWeaponCapacity * Phaser.Math.FloatBetween(0.3, 0.48)));

    switch (type) {
      case "health":
        return { x, y, type, healthAmount: Phaser.Math.Between(20, 34), shieldAmount: 0, ammoAmount: 0 };
      case "shield":
        return { x, y, type, healthAmount: 0, shieldAmount: Phaser.Math.Between(24, 40), ammoAmount: 0 };
      case "ammo":
        return { x, y, type, healthAmount: 0, shieldAmount: 0, ammoAmount };
      case "combo":
        return {
          x,
          y,
          type,
          healthAmount: Phaser.Math.Between(10, 18),
          shieldAmount: Phaser.Math.Between(14, 24),
          ammoAmount: Math.max(4, Math.round(activeWeaponCapacity * 0.24))
        };
    }
  }

  private pickRandomRechargeType(): RechargePickupType {
    const healthRatio = this.playerMaxHealth > 0 ? this.playerHealth / this.playerMaxHealth : 1;
    const shieldRatio = this.playerMaxShield > 0 ? this.playerShield / this.playerMaxShield : 1;
    const ammoRatio = this.activeWeapon.ammoCapacity > 0 ? this.activeAmmo / this.activeWeapon.ammoCapacity : 1;
    const candidates: Array<{ type: RechargePickupType; weight: number }> = [
      { type: "health", weight: healthRatio < 0.55 ? 5 : 2 },
      { type: "shield", weight: shieldRatio < 0.55 ? 5 : 2 },
      { type: "ammo", weight: ammoRatio < 0.4 ? 6 : 3 },
      { type: "combo", weight: 2 }
    ];
    const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    let roll = Phaser.Math.Between(1, totalWeight);

    for (const candidate of candidates) {
      roll -= candidate.weight;

      if (roll <= 0) {
        return candidate.type;
      }
    }

    return "ammo";
  }

  private findRechargeSpawnPoint(): { x: number; y: number } {
    for (let attempt = 0; attempt < 28; attempt += 1) {
      const point = this.getRandomPointInsideSafeZone();

      if (this.isGoodRechargeSpawnPoint(point.x, point.y)) {
        return point;
      }
    }

    return this.getRandomPointInsideSafeZone();
  }

  private isGoodRechargeSpawnPoint(x: number, y: number): boolean {
    if (!this.isInsideSafeZone(x, y, Math.min(24, Math.max(0, this.safeZoneRadius - 42)))) {
      return false;
    }

    const playerClearance = this.safeZoneRadius < 170 ? 40 : 132;
    const enemyClearance = this.safeZoneRadius < 170 ? 34 : 82;

    if (this.player && Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) < playerClearance) {
      return false;
    }

    return !this.enemies.some((enemy) => enemy.isAlive && Phaser.Math.Distance.Between(enemy.x, enemy.y, x, y) < enemyClearance);
  }

  private spawnRechargePickupInsideZone(announce: boolean): void {
    const spawnPoint = this.findRechargeSpawnPoint();
    const config = this.createRandomRechargeConfig(spawnPoint.x, spawnPoint.y);
    this.rechargePickups.push(new RechargePickup(this, config));
    this.showPickupBurst(spawnPoint.x, spawnPoint.y, this.getRechargeBurstColor(config.type));

    if (announce) {
      this.showStatus(`${this.getRechargeName(config.type)} appeared inside the safe zone.`, Palette.accent, 1200);
    }
  }

  private getRandomPointInsideSafeZone(): { x: number; y: number } {
    const safePadding = Math.min(SUPPORT_PICKUP_SPAWN_PADDING, Math.max(18, this.safeZoneRadius * 0.34));
    const usableRadius = Math.max(28, this.safeZoneRadius - safePadding);
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const distance = Math.sqrt(Phaser.Math.FloatBetween(0, 1)) * usableRadius;
    const x = Phaser.Math.Clamp(
      SAFE_ZONE_CENTER.x + Math.cos(angle) * distance,
      ARENA_BOUNDS.x + SUPPORT_PICKUP_SPAWN_PADDING,
      ARENA_BOUNDS.x + ARENA_BOUNDS.width - SUPPORT_PICKUP_SPAWN_PADDING
    );
    const y = Phaser.Math.Clamp(
      SAFE_ZONE_CENTER.y + Math.sin(angle) * distance,
      ARENA_BOUNDS.y + SUPPORT_PICKUP_SPAWN_PADDING,
      ARENA_BOUNDS.y + ARENA_BOUNDS.height - SUPPORT_PICKUP_SPAWN_PADDING
    );

    return { x, y };
  }

  private cullPickupsOutsideSafeZone(): void {
    if (this.safeZoneRadius > 430) {
      return;
    }

    this.cullPickupArrayOutsideSafeZone(this.weaponPickups);
    this.cullPickupArrayOutsideSafeZone(this.lootDrops);
    this.cullPickupArrayOutsideSafeZone(this.rechargePickups);

    if (!this.matchActive || this.safeZoneRadius > 260) {
      return;
    }

    while (this.rechargePickups.length < 2) {
      this.spawnRechargePickupInsideZone(false);
    }
  }

  private cullPickupArrayOutsideSafeZone<T extends { x: number; y: number; collect: () => void }>(pickups: T[]): void {
    for (let index = pickups.length - 1; index >= 0; index -= 1) {
      const pickup = pickups[index];

      if (this.isInsideSafeZone(pickup.x, pickup.y, 18)) {
        continue;
      }

      pickup.collect();
      pickups.splice(index, 1);
    }
  }

  private getRechargeBurstColor(type: RechargePickupType): number {
    switch (type) {
      case "health":
        return 0xfb7185;
      case "ammo":
        return 0x86efac;
      case "shield":
        return 0x67e8f9;
      case "combo":
        return 0xfacc15;
    }
  }

  private getRechargeName(type: RechargePickupType): string {
    switch (type) {
      case "health":
        return "Health pack";
      case "ammo":
        return "Ammo refill";
      case "shield":
        return "Shield cell";
      case "combo":
        return "Supply pack";
    }
  }

  private showMuzzleFlash(x: number, y: number): void {
    const flash = this.add.circle(x, y, 7, 0xfef08a, 0.85);
    flash.setDepth(12);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.8,
      duration: 90,
      onComplete: () => flash.destroy()
    });
  }

  private showPickupBurst(x: number, y: number, color: number): void {
    const burst = this.add.circle(x, y, 12, color, 0.24);
    const ring = this.add.circle(x, y, 20, 0xffffff, 0).setStrokeStyle(2, color, 0.62);
    burst.setDepth(12);
    ring.setDepth(12);
    burst.setBlendMode(Phaser.BlendModes.ADD);
    ring.setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: [burst, ring],
      alpha: 0,
      scale: 2.35,
      duration: 220,
      onComplete: () => {
        burst.destroy();
        ring.destroy();
      }
    });
  }

  private dropEnemyLoot(enemy: EnemyTarget): void {
    const loadout = this.enemyLoadouts.get(enemy);

    if (!loadout) {
      return;
    }

    const weapon = WEAPON_DEFINITIONS[loadout.weaponId];
    const dropPositions = [
      { x: enemy.x + 28, y: enemy.y },
      { x: enemy.x - 22, y: enemy.y + 22 },
      { x: enemy.x + 4, y: enemy.y - 30 }
    ];

    this.weaponPickups.push(
      new WeaponPickup(this, {
        x: Phaser.Math.Clamp(dropPositions[0].x, ARENA_BOUNDS.x + 30, ARENA_BOUNDS.x + ARENA_BOUNDS.width - 30),
        y: Phaser.Math.Clamp(dropPositions[0].y, ARENA_BOUNDS.y + 30, ARENA_BOUNDS.y + ARENA_BOUNDS.height - 30),
        weapon,
        ammo: loadout.ammo
      })
    );

    this.lootDrops.push(
      new LootDrop(this, {
        x: Phaser.Math.Clamp(dropPositions[1].x, ARENA_BOUNDS.x + 24, ARENA_BOUNDS.x + ARENA_BOUNDS.width - 24),
        y: Phaser.Math.Clamp(dropPositions[1].y, ARENA_BOUNDS.y + 24, ARENA_BOUNDS.y + ARENA_BOUNDS.height - 24),
        type: "armor",
        amount: loadout.armorShards
      })
    );

    this.lootDrops.push(
      new LootDrop(this, {
        x: Phaser.Math.Clamp(dropPositions[2].x, ARENA_BOUNDS.x + 24, ARENA_BOUNDS.x + ARENA_BOUNDS.width - 24),
        y: Phaser.Math.Clamp(dropPositions[2].y, ARENA_BOUNDS.y + 24, ARENA_BOUNDS.y + ARENA_BOUNDS.height - 24),
        type: "coins",
        amount: loadout.coinShards
      })
    );
  }

  private showStatus(message: string, color: number, duration = 900): void {
    this.statusText?.setText(message);
    this.statusText?.setColor(Phaser.Display.Color.IntegerToColor(color).rgba);
    this.time.delayedCall(duration, () => {
      this.statusText?.setText(this.playerAlive ? this.defaultStatusText : "Match ended. Results are loading.");
      this.statusText?.setColor(Palette.mutedText);
    });
  }

  private resetMatchState(): void {
    this.bullets.length = 0;
    this.enemies.length = 0;
    this.weaponPickups.length = 0;
    this.lootDrops.length = 0;
    this.rechargePickups.length = 0;
    this.enemyLoadouts.clear();
    this.enemyStandingStats.clear();
    this.botMovementStates.clear();
    this.eliminatedEnemies.length = 0;
    this.matchSpawnPoints.length = 0;
    this.multiplayerRemoteTargets.clear();
    this.multiplayerBulletSprites.forEach((sprite) => sprite.destroy());
    this.multiplayerBulletSprites.clear();
    this.clearCountdownTimers();
    this.player = undefined;
    this.cursorKeys = undefined;
    this.movementKeys = undefined;
    this.actionKeys = undefined;
    this.touchControls = undefined;
    this.tutorialGuide = undefined;
    this.aimReticle = undefined;
    this.weaponText = undefined;
    this.healthBarFill = undefined;
    this.shieldBarFill = undefined;
    this.pickupPromptText = undefined;
    this.scoreText = undefined;
    this.killsText = undefined;
    this.timerText = undefined;
    this.safeZoneText = undefined;
    this.soundText = undefined;
    this.statusText = undefined;
    this.countdownOverlay = undefined;
    this.countdownText = undefined;
    this.countdownSubtext = undefined;
    this.pauseOverlay = undefined;
    this.safeZoneGraphics = undefined;
    this.collectedWeapons.clear();
    this.collectedWeapons.add("pistol");
    this.activeWeaponId = "pistol";
    this.inventoryAmmo = {
      pistol: WEAPON_DEFINITIONS.pistol.ammoCapacity,
      smg: 0,
      shotgun: 0,
      rifle: 0
    };
    this.lastShotAt = Number.NEGATIVE_INFINITY;
    this.score = 0;
    this.kills = 0;
    this.damageDealt = 0;
    this.armorShards = 0;
    this.coinShards = 0;
    this.playerAlive = true;
    this.matchActive = false;
    this.matchPaused = false;
    this.pauseStartedAt = 0;
    this.pauseReason = "manual";
    this.matchFinalized = false;
    this.matchStartAt = 0;
    this.countdownEndsAt = 0;
    this.battleBeginEndsAt = 0;
    this.lastCountdownNumber = 0;
    this.battleBeginStarted = false;
    this.countdownOverlay = undefined;
    this.countdownText = undefined;
    this.countdownSubtext = undefined;
    this.tutorialEnabled = !saveSystem.loadProgress().tutorialSeen;
    this.nextRechargeSpawnAt = Number.POSITIVE_INFINITY;
    this.tutorialMoved = false;
    this.tutorialFired = false;
    this.tutorialCollected = false;
    this.tutorialCollectedWeapon = false;
    this.tutorialSwitched = false;
    this.tutorialZoneStartedAt = Number.NEGATIVE_INFINITY;
    this.currentTutorialStep = undefined;
    this.tutorialGuide = undefined;
    this.safeZoneRadius = SAFE_ZONE_PHASES[0].fromRadius;
    this.lastZoneWarningAt = Number.NEGATIVE_INFINITY;
    this.lastZoneDamageTickAt = Number.NEGATIVE_INFINITY;
    this.lastMultiplayerInputAt = 0;
    this.multiplayerMatchEnded = false;
    this.initializePlayerStats();
  }

  private get activeWeapon(): WeaponDefinition {
    return WEAPON_DEFINITIONS[this.activeWeaponId];
  }

  private getNow(): number {
    return Date.now();
  }

  private get activeAmmo(): number {
    return this.inventoryAmmo[this.activeWeaponId];
  }

  private findNearestWeaponPickup(): { index: number; distance: number } | null {
    if (!this.player) {
      return null;
    }

    let nearest: { index: number; distance: number } | null = null;

    this.weaponPickups.forEach((pickup, index) => {
      if (!pickup.isInRange(this.player!.x, this.player!.y)) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(this.player!.x, this.player!.y, pickup.x, pickup.y);

      if (!nearest || distance < nearest.distance) {
        nearest = { index, distance };
      }
    });

    return nearest;
  }

  private findNearestLootDrop(): { index: number; distance: number } | null {
    if (!this.player) {
      return null;
    }

    let nearest: { index: number; distance: number } | null = null;

    this.lootDrops.forEach((drop, index) => {
      if (!drop.isInRange(this.player!.x, this.player!.y)) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(this.player!.x, this.player!.y, drop.x, drop.y);

      if (!nearest || distance < nearest.distance) {
        nearest = { index, distance };
      }
    });

    return nearest;
  }

  private findNearestRechargePickup(): { index: number; distance: number } | null {
    if (!this.player) {
      return null;
    }

    let nearest: { index: number; distance: number } | null = null;

    this.rechargePickups.forEach((pickup, index) => {
      if (!pickup.isInRange(this.player!.x, this.player!.y)) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(this.player!.x, this.player!.y, pickup.x, pickup.y);

      if (!nearest || distance < nearest.distance) {
        nearest = { index, distance };
      }
    });

    return nearest;
  }

  private updateLootHud(): void {
    this.updateWeaponHud();
  }

  private initializePlayerStats(): void {
    const progress = saveSystem.loadProgress();

    this.playerMaxHealth = 100 + progress.upgrades.healthBoost;
    this.playerMaxShield = 50 + progress.upgrades.shieldBoost;
    this.ammoEfficiencyLevel = progress.upgrades.ammoEfficiency;
    this.playerHealth = this.playerMaxHealth;
    this.playerShield = this.playerMaxShield;
  }
}
