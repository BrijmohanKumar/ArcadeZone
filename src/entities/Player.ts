import Phaser from "phaser";
import { getTankSkin, type TankSkinDefinition } from "../data/tankSkins";

export type MovementInput = {
  x: number;
  y: number;
};

export type ArenaBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PlayerConfig = {
  x: number;
  y: number;
  name: string;
  color?: number;
  skin?: TankSkinDefinition;
  speed?: number;
};

export class Player {
  private readonly radius = 20;
  private readonly speed: number;
  private readonly container: Phaser.GameObjects.Container;
  private readonly chassis: Phaser.GameObjects.Container;
  private readonly turret: Phaser.GameObjects.Container;
  private readonly shieldRing: Phaser.GameObjects.Arc;
  private readonly shieldColor: number;
  private readonly barrel: Phaser.GameObjects.Rectangle;
  private readonly treadMarks: Phaser.GameObjects.Rectangle[] = [];
  private readonly movementVector = new Phaser.Math.Vector2();
  private readonly aimTarget = new Phaser.Math.Vector2();
  private aimAngle = 0;
  private bodyAngle = -Math.PI / 2;
  private treadPhase = 0;

  constructor(scene: Phaser.Scene, config: PlayerConfig) {
    this.speed = config.speed ?? 230;
    this.aimTarget.set(config.x + 1, config.y);
    const skin = config.skin ?? getTankSkin("sky");
    const primaryColor = config.color ?? skin.primary;
    this.shieldColor = skin.accent;

    const shadow = scene.add.ellipse(0, 7, 36, 16, 0x000000, 0.24);
    const glow = scene.add.ellipse(0, 0, 58, 42, skin.glow, 0.12).setBlendMode(Phaser.BlendModes.ADD);
    this.shieldRing = scene.add.circle(0, 0, 28, 0xffffff, 0).setStrokeStyle(2, skin.accent, 0.75);

    const leftTrack = scene.add.rectangle(0, -14, 44, 9, skin.track, 1).setStrokeStyle(1, 0x64748b, 0.9);
    const rightTrack = scene.add.rectangle(0, 14, 44, 9, skin.track, 1).setStrokeStyle(1, 0x64748b, 0.9);
    const hull = scene.add.rectangle(0, 0, 34, 26, primaryColor, 1).setStrokeStyle(2, skin.barrel, 0.95);
    const frontArmor = scene.add.rectangle(13, 0, 10, 20, skin.dark, 0.7);
    const rearArmor = scene.add.rectangle(-13, 0, 6, 18, 0xe0f2fe, 0.22);

    for (let index = 0; index < 6; index += 1) {
      const markerX = -18 + index * 7;
      this.treadMarks.push(scene.add.rectangle(markerX, -14, 3, 7, 0x94a3b8, 0.55));
      this.treadMarks.push(scene.add.rectangle(markerX, 14, 3, 7, 0x94a3b8, 0.55));
    }

    this.chassis = scene.add.container(0, 0, [leftTrack, rightTrack, ...this.treadMarks, hull, frontArmor, rearArmor]);
    this.chassis.rotation = this.bodyAngle;

    this.barrel = scene.add.rectangle(12, 0, 38, 6, skin.barrel, 1).setOrigin(0, 0.5);
    const turretBase = scene.add.rectangle(0, 0, 24, 18, skin.turret, 1).setStrokeStyle(2, 0x0f172a, 1);
    const turretTop = scene.add.rectangle(-5, 0, 10, 12, skin.dark, 0.55);
    this.turret = scene.add.container(0, 0, [this.barrel, turretBase, turretTop]);

    this.container = scene.add.container(config.x, config.y, [
      shadow,
      glow,
      this.chassis,
      this.shieldRing,
      this.turret
    ]);
    this.container.setDepth(6);

    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.08, to: 0.2 },
      scale: { from: 0.9, to: 1.12 },
      duration: 1150,
      yoyo: true,
      repeat: -1
    });
  }

  update(deltaMs: number, input: MovementInput, bounds: ArenaBounds): void {
    this.movementVector.set(input.x, input.y);
    const isMoving = this.movementVector.lengthSq() > 0;

    if (isMoving) {
      this.movementVector.normalize();
      const targetBodyAngle = Math.atan2(this.movementVector.y, this.movementVector.x);
      this.bodyAngle = this.rotateToward(this.bodyAngle, targetBodyAngle, deltaMs * 0.014);
      this.chassis.rotation = this.bodyAngle;
      this.animateTreads(deltaMs);

      const deltaSeconds = deltaMs / 1000;
      this.container.x += this.movementVector.x * this.speed * deltaSeconds;
      this.container.y += this.movementVector.y * this.speed * deltaSeconds;
    } else {
      this.treadMarks.forEach((mark) => mark.setAlpha(0.42));
    }

    this.container.x = Phaser.Math.Clamp(
      this.container.x,
      bounds.x + this.radius,
      bounds.x + bounds.width - this.radius
    );
    this.container.y = Phaser.Math.Clamp(
      this.container.y,
      bounds.y + this.radius,
      bounds.y + bounds.height - this.radius
    );

    this.aimAngle = Phaser.Math.Angle.Between(
      this.container.x,
      this.container.y,
      this.aimTarget.x,
      this.aimTarget.y
    );
    this.turret.rotation = this.aimAngle;
  }

  syncNetworkState(config: { x: number; y: number; aimAngle: number; moveX: number; moveY: number; deltaMs: number; bounds: ArenaBounds }): void {
    this.container.x = Phaser.Math.Linear(this.container.x, config.x, 0.45);
    this.container.y = Phaser.Math.Linear(this.container.y, config.y, 0.45);
    this.container.x = Phaser.Math.Clamp(
      this.container.x,
      config.bounds.x + this.radius,
      config.bounds.x + config.bounds.width - this.radius
    );
    this.container.y = Phaser.Math.Clamp(
      this.container.y,
      config.bounds.y + this.radius,
      config.bounds.y + config.bounds.height - this.radius
    );
    this.movementVector.set(config.moveX, config.moveY);

    if (this.movementVector.lengthSq() > 0) {
      this.movementVector.normalize();
      const targetBodyAngle = Math.atan2(this.movementVector.y, this.movementVector.x);
      this.bodyAngle = this.rotateToward(this.bodyAngle, targetBodyAngle, config.deltaMs * 0.014);
      this.chassis.rotation = this.bodyAngle;
      this.animateTreads(config.deltaMs);
    } else {
      this.treadMarks.forEach((mark) => mark.setAlpha(0.42));
    }

    this.aimAngle = config.aimAngle;
    this.turret.rotation = this.aimAngle;
  }

  setAimTarget(x: number, y: number): void {
    this.aimTarget.set(x, y);
  }

  get x(): number {
    return this.container.x;
  }

  get y(): number {
    return this.container.y;
  }

  getAimAngle(): number {
    return this.aimAngle;
  }

  getMuzzlePosition(offset = 52): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      this.container.x + Math.cos(this.aimAngle) * offset,
      this.container.y + Math.sin(this.aimAngle) * offset
    );
  }

  setShieldRatio(ratio: number): void {
    const clampedRatio = Phaser.Math.Clamp(ratio, 0, 1);
    this.shieldRing.setAlpha(0.2 + clampedRatio * 0.75);
    this.shieldRing.setScale(0.92 + clampedRatio * 0.18);
  }

  playRechargePulse(color = 0x67e8f9): void {
    this.shieldRing.setStrokeStyle(3, color, 1);
    this.shieldRing.scene.time.delayedCall(160, () => {
      this.shieldRing.setStrokeStyle(2, this.shieldColor, this.shieldRing.alpha);
    });
  }

  private animateTreads(deltaMs: number): void {
    this.treadPhase = (this.treadPhase + deltaMs * 0.018) % 14;
    this.treadMarks.forEach((mark, index) => {
      const localIndex = Math.floor(index / 2);
      const offset = (this.treadPhase + localIndex * 7) % 14;
      mark.x = -20 + offset + localIndex * 3.4;
      mark.setAlpha(0.45 + (localIndex % 2) * 0.2);
    });
  }

  private rotateToward(current: number, target: number, maxStep: number): number {
    const delta = Phaser.Math.Angle.Wrap(target - current);
    return current + Phaser.Math.Clamp(delta, -maxStep, maxStep);
  }
}
