import Phaser from "phaser";
import type { EnemyTarget } from "./EnemyTarget";
import type { ArenaBounds } from "./Player";

export type BulletOwner = "player" | "bot";

export type BulletConfig = {
  x: number;
  y: number;
  angle: number;
  speed: number;
  range: number;
  damage: number;
  radius: number;
  color: number;
  owner: BulletOwner;
  sourceEnemy?: EnemyTarget;
};

export class Bullet {
  private readonly sprite: Phaser.GameObjects.Arc;
  private readonly velocity: Phaser.Math.Vector2;
  private readonly range: number;
  private readonly radius: number;
  private distanceTraveled = 0;
  readonly damage: number;
  readonly owner: BulletOwner;
  readonly sourceEnemy?: EnemyTarget;

  constructor(scene: Phaser.Scene, config: BulletConfig) {
    this.range = config.range;
    this.radius = config.radius;
    this.damage = config.damage;
    this.owner = config.owner;
    this.sourceEnemy = config.sourceEnemy;
    this.velocity = new Phaser.Math.Vector2(Math.cos(config.angle), Math.sin(config.angle)).scale(config.speed);
    this.sprite = scene.add.circle(config.x, config.y, config.radius, config.color, 1);
    this.sprite.setStrokeStyle(1, 0xffffff, 0.35);
    this.sprite.setDepth(8);
  }

  update(deltaMs: number, bounds: ArenaBounds): boolean {
    const deltaSeconds = deltaMs / 1000;
    const moveX = this.velocity.x * deltaSeconds;
    const moveY = this.velocity.y * deltaSeconds;
    const stepDistance = Math.hypot(moveX, moveY);

    this.sprite.x += moveX;
    this.sprite.y += moveY;
    this.distanceTraveled += stepDistance;

    if (this.distanceTraveled >= this.range || this.isOutsideBounds(bounds)) {
      this.destroy();
      return false;
    }

    return true;
  }

  destroy(): void {
    this.sprite.destroy();
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get collisionRadius(): number {
    return this.radius;
  }

  private isOutsideBounds(bounds: ArenaBounds): boolean {
    const padding = this.radius + 4;

    return (
      this.sprite.x < bounds.x - padding ||
      this.sprite.x > bounds.x + bounds.width + padding ||
      this.sprite.y < bounds.y - padding ||
      this.sprite.y > bounds.y + bounds.height + padding
    );
  }
}
