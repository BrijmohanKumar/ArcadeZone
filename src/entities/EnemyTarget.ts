import Phaser from "phaser";
import { ARENA_BOUNDS, Palette } from "../game/constants";
import type { ArenaBounds } from "./Player";

export type DamageResult = {
  absorbedByShield: number;
  dealtToHealth: number;
  totalApplied: number;
  killed: boolean;
};

export type EnemyTargetConfig = {
  x: number;
  y: number;
  name: string;
  maxHealth?: number;
  maxShield?: number;
  color?: number;
  speed?: number;
  preferredRange?: number;
};

export class EnemyTarget {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly chassis: Phaser.GameObjects.Container;
  private readonly turret: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Rectangle;
  private readonly weapon: Phaser.GameObjects.Rectangle;
  private readonly treadMarks: Phaser.GameObjects.Rectangle[] = [];
  private readonly healthFill: Phaser.GameObjects.Rectangle;
  private readonly shieldFill: Phaser.GameObjects.Rectangle;
  private readonly maxHealth: number;
  private readonly maxShield: number;
  private readonly baseColor: number;
  private readonly speed: number;
  private readonly preferredRange: number;
  private readonly movementVector = new Phaser.Math.Vector2();
  private aimAngle = 0;
  private bodyAngle = Math.PI / 2;
  private treadPhase = 0;
  private health: number;
  private shield: number;
  private alive = true;
  readonly collisionRadius = 18;

  constructor(scene: Phaser.Scene, config: EnemyTargetConfig) {
    this.scene = scene;
    this.maxHealth = config.maxHealth ?? 80;
    this.maxShield = config.maxShield ?? 40;
    this.health = this.maxHealth;
    this.shield = this.maxShield;
    this.baseColor = config.color ?? Palette.danger;
    this.speed = config.speed ?? 92;
    this.preferredRange = config.preferredRange ?? 250;

    const shadow = scene.add.ellipse(0, 7, 40, 18, 0x000000, 0.24);
    const glow = scene.add.ellipse(0, 0, 58, 42, this.baseColor, 0.1).setBlendMode(Phaser.BlendModes.ADD);
    const leftTrack = scene.add.rectangle(0, -14, 42, 9, 0x111827, 1).setStrokeStyle(1, 0x475569, 0.9);
    const rightTrack = scene.add.rectangle(0, 14, 42, 9, 0x111827, 1).setStrokeStyle(1, 0x475569, 0.9);
    this.body = scene.add.rectangle(0, 0, 32, 25, this.baseColor, 1).setStrokeStyle(2, 0xffedd5, 0.48);
    const frontPlate = scene.add.rectangle(13, 0, 9, 19, 0x7f1d1d, 0.52);
    const rearPlate = scene.add.rectangle(-13, 0, 6, 17, 0xffffff, 0.18);

    for (let index = 0; index < 6; index += 1) {
      const markerX = -17 + index * 7;
      this.treadMarks.push(scene.add.rectangle(markerX, -14, 3, 7, 0x94a3b8, 0.45));
      this.treadMarks.push(scene.add.rectangle(markerX, 14, 3, 7, 0x94a3b8, 0.45));
    }

    this.chassis = scene.add.container(0, 0, [leftTrack, rightTrack, ...this.treadMarks, this.body, frontPlate, rearPlate]);
    this.chassis.rotation = this.bodyAngle;

    this.weapon = scene.add.rectangle(11, 0, 34, 6, 0xfef2f2, 1).setOrigin(0, 0.5);
    const turretBase = scene.add.rectangle(0, 0, 22, 16, 0xfef2f2, 1).setStrokeStyle(2, 0x0f172a, 1);
    const turretCap = scene.add.rectangle(-5, 0, 9, 11, 0x7f1d1d, 0.45);
    const shieldRing = scene.add.circle(0, 0, 28, 0xffffff, 0).setStrokeStyle(2, 0x67e8f9, 0.65);
    this.turret = scene.add.container(0, 0, [this.weapon, turretBase, turretCap]);

    const shieldBack = scene.add.rectangle(-24, -32, 48, 4, 0x1e293b, 1).setOrigin(0, 0.5);
    this.shieldFill = scene.add.rectangle(-24, -32, 48, 4, 0x67e8f9, 1).setOrigin(0, 0.5);
    const healthBack = scene.add.rectangle(-24, -26, 48, 5, 0x1e293b, 1).setOrigin(0, 0.5);
    this.healthFill = scene.add.rectangle(-24, -26, 48, 5, 0xef4444, 1).setOrigin(0, 0.5);

    this.container = scene.add.container(config.x, config.y, [
      shadow,
      glow,
      this.chassis,
      shieldRing,
      this.turret,
      shieldBack,
      this.shieldFill,
      healthBack,
      this.healthFill
    ]);
    this.container.setDepth(5);

    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.07, to: 0.18 },
      scale: { from: 0.92, to: 1.12 },
      duration: 1000 + Phaser.Math.Between(0, 420),
      yoyo: true,
      repeat: -1
    });
  }

  updateBot(deltaMs: number, targetX: number, targetY: number, bounds: ArenaBounds): void {
    if (!this.alive) {
      return;
    }

    this.aimAt(targetX, targetY);

    const distanceToTarget = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
    const moveDirection = distanceToTarget > this.preferredRange ? 1 : distanceToTarget < this.preferredRange * 0.58 ? -1 : 0;

    if (moveDirection !== 0) {
      this.movementVector.set(Math.cos(this.aimAngle), Math.sin(this.aimAngle)).scale(moveDirection);
    } else {
      this.movementVector.set(Math.cos(this.aimAngle + Math.PI / 2), Math.sin(this.aimAngle + Math.PI / 2)).scale(0.35);
    }

    this.applyMovement(deltaMs, bounds, 1);
  }

  aimAt(targetX: number, targetY: number): void {
    if (!this.alive) {
      return;
    }

    this.aimAngle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    this.turret.rotation = this.aimAngle;
  }

  moveToward(deltaMs: number, targetX: number, targetY: number, bounds: ArenaBounds, speedMultiplier = 1): void {
    if (!this.alive) {
      return;
    }

    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    this.movementVector.set(Math.cos(angle), Math.sin(angle));
    this.applyMovement(deltaMs, bounds, speedMultiplier);
  }

  moveAwayFrom(deltaMs: number, threatX: number, threatY: number, bounds: ArenaBounds, speedMultiplier = 1): void {
    if (!this.alive) {
      return;
    }

    const angle = Phaser.Math.Angle.Between(threatX, threatY, this.x, this.y);
    this.movementVector.set(Math.cos(angle), Math.sin(angle));
    this.applyMovement(deltaMs, bounds, speedMultiplier);
  }

  syncNetworkState(config: {
    x: number;
    y: number;
    aimAngle: number;
    moveX: number;
    moveY: number;
    healthRatio: number;
    shieldRatio: number;
    alive: boolean;
    deltaMs: number;
  }): void {
    if (!config.alive) {
      if (this.alive) {
        this.alive = false;
        this.playDeathFeedback();
      }

      return;
    }

    this.container.x = Phaser.Math.Linear(this.container.x, config.x, 0.45);
    this.container.y = Phaser.Math.Linear(this.container.y, config.y, 0.45);
    this.aimAngle = config.aimAngle;
    this.turret.rotation = this.aimAngle;
    this.health = this.maxHealth * Phaser.Math.Clamp(config.healthRatio, 0, 1);
    this.shield = this.maxShield * Phaser.Math.Clamp(config.shieldRatio, 0, 1);
    this.updateBars();
    this.movementVector.set(config.moveX, config.moveY);

    if (this.movementVector.lengthSq() > 0) {
      this.movementVector.normalize();
      const targetBodyAngle = Math.atan2(this.movementVector.y, this.movementVector.x);
      this.bodyAngle = this.rotateToward(this.bodyAngle, targetBodyAngle, config.deltaMs * 0.012);
      this.chassis.rotation = this.bodyAngle;
      this.animateTreads(config.deltaMs);
    } else {
      this.treadMarks.forEach((mark) => mark.setAlpha(0.38));
    }
  }

  restoreShield(amount: number): number {
    if (!this.alive || amount <= 0) {
      return 0;
    }

    const before = this.shield;
    this.shield = Phaser.Math.Clamp(this.shield + amount, 0, this.maxShield);
    this.updateBars();
    return Math.round(this.shield - before);
  }

  restoreHealth(amount: number): number {
    if (!this.alive || amount <= 0) {
      return 0;
    }

    const before = this.health;
    this.health = Phaser.Math.Clamp(this.health + amount, 0, this.maxHealth);
    this.updateBars();
    return Math.round(this.health - before);
  }

  takeDamage(amount: number): DamageResult {
    if (!this.alive) {
      return { absorbedByShield: 0, dealtToHealth: 0, totalApplied: 0, killed: false };
    }

    const shieldBefore = this.shield;
    this.shield = Math.max(0, this.shield - amount);
    const absorbedByShield = shieldBefore - this.shield;
    const remainingDamage = amount - absorbedByShield;
    const healthBefore = this.health;
    this.health = Math.max(0, this.health - remainingDamage);
    const dealtToHealth = healthBefore - this.health;
    const killed = this.health <= 0;

    this.updateBars();
    this.playHitFeedback(absorbedByShield + dealtToHealth);

    if (killed) {
      this.alive = false;
      this.playDeathFeedback();
    }

    return {
      absorbedByShield,
      dealtToHealth,
      totalApplied: absorbedByShield + dealtToHealth,
      killed
    };
  }

  isHitBy(x: number, y: number, radius: number): boolean {
    if (!this.alive) {
      return false;
    }

    return Phaser.Math.Distance.Between(this.x, this.y, x, y) <= this.collisionRadius + radius;
  }

  get isAlive(): boolean {
    return this.alive;
  }

  get x(): number {
    return this.container.x;
  }

  get y(): number {
    return this.container.y;
  }

  get healthRatio(): number {
    return Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
  }

  get shieldRatio(): number {
    return Phaser.Math.Clamp(this.shield / this.maxShield, 0, 1);
  }

  get preferredCombatRange(): number {
    return this.preferredRange;
  }

  getAimAngle(): number {
    return this.aimAngle;
  }

  getMuzzlePosition(offset = 48): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.x + Math.cos(this.aimAngle) * offset, this.y + Math.sin(this.aimAngle) * offset);
  }

  playShootPulse(): void {
    this.weapon.setFillStyle(0xfef08a);
    this.scene.time.delayedCall(80, () => {
      if (this.alive) {
        this.weapon.setFillStyle(0xfef2f2);
      }
    });
  }

  private applyMovement(deltaMs: number, bounds: ArenaBounds, speedMultiplier: number): void {
    if (this.movementVector.lengthSq() > 0) {
      this.movementVector.normalize();
    }

    const deltaSeconds = deltaMs / 1000;
    const wantsToMove = this.movementVector.lengthSq() > 0;

    if (wantsToMove) {
      const targetBodyAngle = Math.atan2(this.movementVector.y, this.movementVector.x);
      this.bodyAngle = this.rotateToward(this.bodyAngle, targetBodyAngle, deltaMs * 0.012);
      this.chassis.rotation = this.bodyAngle;
      this.animateTreads(deltaMs);
    } else {
      this.treadMarks.forEach((mark) => mark.setAlpha(0.38));
    }

    const beforeX = this.container.x;
    const beforeY = this.container.y;
    this.container.x += this.movementVector.x * this.speed * speedMultiplier * deltaSeconds;
    this.container.y += this.movementVector.y * this.speed * speedMultiplier * deltaSeconds;
    this.container.x = Phaser.Math.Clamp(this.container.x, bounds.x + this.collisionRadius, bounds.x + bounds.width - this.collisionRadius);
    this.container.y = Phaser.Math.Clamp(this.container.y, bounds.y + this.collisionRadius, bounds.y + bounds.height - this.collisionRadius);

    const movedDistanceSq = Phaser.Math.Distance.Squared(beforeX, beforeY, this.container.x, this.container.y);

    if (wantsToMove && movedDistanceSq < 0.35) {
      this.applyBoundaryEscape(deltaSeconds, bounds, speedMultiplier);
    }
  }

  private updateBars(): void {
    this.shieldFill.scaleX = Phaser.Math.Clamp(this.shield / this.maxShield, 0, 1);
    this.healthFill.scaleX = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
  }

  private playHitFeedback(amount: number): void {
    this.body.setFillStyle(0xffffff);
    this.scene.time.delayedCall(70, () => {
      if (this.alive) {
        this.body.setFillStyle(this.baseColor);
      }
    });

    const startY = Math.max(ARENA_BOUNDS.y + 26, this.y - 48);
    const endY = Math.max(ARENA_BOUNDS.y + 14, startY - 22);
    const damageText = this.scene.add
      .text(this.x, startY, `${Math.round(amount)}`, {
        color: "#f8fafc",
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        fontStyle: "800",
        stroke: "#0b1020",
        strokeThickness: 3
      })
      .setOrigin(0.5);

    this.scene.tweens.add({
      targets: damageText,
      y: endY,
      alpha: 0,
      duration: 460,
      onComplete: () => damageText.destroy()
    });
  }

  private playDeathFeedback(): void {
    const burst = this.scene.add.circle(this.x, this.y, 10, 0xf87171, 0.55);
    burst.setDepth(10);

    this.scene.tweens.add({
      targets: burst,
      scale: 4,
      alpha: 0,
      duration: 260,
      onComplete: () => burst.destroy()
    });

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0.35,
      scale: 0.78,
      angle: 20,
      duration: 180
    });
  }

  private animateTreads(deltaMs: number): void {
    this.treadPhase = (this.treadPhase + deltaMs * 0.014) % 14;
    this.treadMarks.forEach((mark, index) => {
      const localIndex = Math.floor(index / 2);
      const offset = (this.treadPhase + localIndex * 7) % 14;
      mark.x = -19 + offset + localIndex * 3.2;
      mark.setAlpha(0.38 + (localIndex % 2) * 0.18);
    });
  }

  private applyBoundaryEscape(deltaSeconds: number, bounds: ArenaBounds, speedMultiplier: number): void {
    let escapeX = 0;
    let escapeY = 0;
    const minX = bounds.x + this.collisionRadius;
    const maxX = bounds.x + bounds.width - this.collisionRadius;
    const minY = bounds.y + this.collisionRadius;
    const maxY = bounds.y + bounds.height - this.collisionRadius;

    if (this.container.x <= minX + 1) {
      escapeX = 1;
    } else if (this.container.x >= maxX - 1) {
      escapeX = -1;
    }

    if (this.container.y <= minY + 1) {
      escapeY = 1;
    } else if (this.container.y >= maxY - 1) {
      escapeY = -1;
    }

    if (escapeX === 0 && escapeY === 0) {
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      const angleToCenter = Phaser.Math.Angle.Between(this.container.x, this.container.y, centerX, centerY);
      escapeX = Math.cos(angleToCenter);
      escapeY = Math.sin(angleToCenter);
    }

    this.movementVector.set(escapeX, escapeY).normalize();
    const escapeBodyAngle = Math.atan2(this.movementVector.y, this.movementVector.x);
    this.bodyAngle = this.rotateToward(this.bodyAngle, escapeBodyAngle, 0.3);
    this.chassis.rotation = this.bodyAngle;
    this.container.x += this.movementVector.x * this.speed * speedMultiplier * deltaSeconds * 0.9;
    this.container.y += this.movementVector.y * this.speed * speedMultiplier * deltaSeconds * 0.9;
    this.container.x = Phaser.Math.Clamp(this.container.x, minX, maxX);
    this.container.y = Phaser.Math.Clamp(this.container.y, minY, maxY);
  }

  private rotateToward(current: number, target: number, maxStep: number): number {
    const delta = Phaser.Math.Angle.Wrap(target - current);
    return current + Phaser.Math.Clamp(delta, -maxStep, maxStep);
  }
}
