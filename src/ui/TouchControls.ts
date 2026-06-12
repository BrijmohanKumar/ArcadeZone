import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, Palette } from "../game/constants";

export type TouchMovementInput = {
  x: number;
  y: number;
};

const JOYSTICK_CENTER = { x: 108, y: GAME_HEIGHT - 110 } as const;
const JOYSTICK_RADIUS = 56;
const FIRE_CENTER = { x: GAME_WIDTH - 92, y: GAME_HEIGHT - 112 } as const;
const ACTION_CENTER = { x: GAME_WIDTH - 190, y: GAME_HEIGHT - 116 } as const;
const WEAPON_CENTER = { x: GAME_WIDTH - 190, y: GAME_HEIGHT - 188 } as const;
const BUTTON_RADIUS = 34;
const FIRE_RADIUS = 48;
const CONTROL_DEPTH = 45;
const ACTIVE_AIM_MS = 2400;

type RoundButton = {
  body: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
};

export class TouchControls {
  private readonly scene: Phaser.Scene;
  private readonly movementState: TouchMovementInput = { x: 0, y: 0 };
  private readonly controlPointers = new Set<Phaser.Input.Pointer>();
  private readonly base: Phaser.GameObjects.Arc;
  private readonly thumb: Phaser.GameObjects.Arc;
  private readonly fireButton: RoundButton;
  private readonly interactButton: RoundButton;
  private readonly weaponButton: RoundButton;
  private readonly fireZone: Phaser.GameObjects.Zone;
  private readonly interactZone: Phaser.GameObjects.Zone;
  private readonly weaponZone: Phaser.GameObjects.Zone;
  private joystickPointer?: Phaser.Input.Pointer;
  private firePointer?: Phaser.Input.Pointer;
  private interactQueued = false;
  private cycleQueued = false;
  private lastActiveAt = Number.NEGATIVE_INFINITY;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.scene.input.addPointer(3);

    this.base = this.scene.add
      .circle(JOYSTICK_CENTER.x, JOYSTICK_CENTER.y, JOYSTICK_RADIUS, 0x0f172a, 0.48)
      .setStrokeStyle(3, 0x7dd3fc, 0.54)
      .setDepth(CONTROL_DEPTH);
    this.thumb = this.scene.add
      .circle(JOYSTICK_CENTER.x, JOYSTICK_CENTER.y, 22, Palette.player, 0.72)
      .setStrokeStyle(2, 0xb7f7ff, 0.88)
      .setDepth(CONTROL_DEPTH + 1);

    this.fireButton = this.createRoundButton(FIRE_CENTER.x, FIRE_CENTER.y, FIRE_RADIUS, "+", 0xef4444);
    this.interactButton = this.createRoundButton(ACTION_CENTER.x, ACTION_CENTER.y, BUTTON_RADIUS, "E", Palette.accent);
    this.weaponButton = this.createRoundButton(WEAPON_CENTER.x, WEAPON_CENTER.y, BUTTON_RADIUS, ">", 0x93c5fd);

    this.fireZone = this.createZone(FIRE_CENTER.x, FIRE_CENTER.y, FIRE_RADIUS * 2.2, (pointer) => {
      this.captureControlPointer(pointer);
      this.firePointer = pointer;
      this.markActive();
      this.setButtonPressed(this.fireButton, true, 0xef4444);
    });
    this.interactZone = this.createZone(ACTION_CENTER.x, ACTION_CENTER.y, BUTTON_RADIUS * 2.25, (pointer) => {
      this.captureControlPointer(pointer);
      this.interactQueued = true;
      this.markActive();
      this.pulseButton(this.interactButton, Palette.accent);
    });
    this.weaponZone = this.createZone(WEAPON_CENTER.x, WEAPON_CENTER.y, BUTTON_RADIUS * 2.25, (pointer) => {
      this.captureControlPointer(pointer);
      this.cycleQueued = true;
      this.markActive();
      this.pulseButton(this.weaponButton, 0x93c5fd);
    });

    this.scene.input.on("pointerdown", this.handlePointerDown, this);
    this.scene.input.on("pointermove", this.handlePointerMove, this);
    this.scene.input.on("pointerup", this.handlePointerUp, this);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  get movement(): TouchMovementInput {
    return this.movementState;
  }

  get fireDown(): boolean {
    return this.firePointer !== undefined;
  }

  get wantsAimAssist(): boolean {
    return this.fireDown || this.joystickPointer !== undefined || this.scene.time.now - this.lastActiveAt < ACTIVE_AIM_MS;
  }

  isControlPointer(pointer: Phaser.Input.Pointer): boolean {
    return this.controlPointers.has(pointer);
  }

  consumeInteractPress(): boolean {
    const wasQueued = this.interactQueued;
    this.interactQueued = false;
    return wasQueued;
  }

  consumeCyclePress(): boolean {
    const wasQueued = this.cycleQueued;
    this.cycleQueued = false;
    return wasQueued;
  }

  cancelActiveInput(): void {
    this.joystickPointer = undefined;
    this.firePointer = undefined;
    this.interactQueued = false;
    this.cycleQueued = false;
    this.movementState.x = 0;
    this.movementState.y = 0;
    this.controlPointers.clear();
    this.thumb.setPosition(JOYSTICK_CENTER.x, JOYSTICK_CENTER.y);
    this.base.setFillStyle(0x0f172a, 0.48);
    this.setButtonPressed(this.fireButton, false, 0xef4444);
    this.setButtonPressed(this.interactButton, false, Palette.accent);
    this.setButtonPressed(this.weaponButton, false, 0x93c5fd);
  }

  destroy(): void {
    this.cancelActiveInput();
    this.scene.input.off("pointerdown", this.handlePointerDown, this);
    this.scene.input.off("pointermove", this.handlePointerMove, this);
    this.scene.input.off("pointerup", this.handlePointerUp, this);
    this.base.destroy();
    this.thumb.destroy();
    this.fireButton.body.destroy();
    this.fireButton.label.destroy();
    this.interactButton.body.destroy();
    this.interactButton.label.destroy();
    this.weaponButton.body.destroy();
    this.weaponButton.label.destroy();
    this.fireZone.destroy();
    this.interactZone.destroy();
    this.weaponZone.destroy();
  }

  private createRoundButton(x: number, y: number, radius: number, label: string, color: number): RoundButton {
    const body = this.scene.add
      .circle(x, y, radius, 0x0f172a, 0.54)
      .setStrokeStyle(3, color, 0.78)
      .setDepth(CONTROL_DEPTH);
    const text = this.scene.add
      .text(x, y, label, {
        color: Palette.text,
        fontFamily: "Arial, sans-serif",
        fontSize: radius > 40 ? "34px" : "26px",
        fontStyle: "900"
      })
      .setOrigin(0.5)
      .setDepth(CONTROL_DEPTH + 1);

    return { body, label: text };
  }

  private createZone(
    x: number,
    y: number,
    size: number,
    onDown: (pointer: Phaser.Input.Pointer) => void
  ): Phaser.GameObjects.Zone {
    const zone = this.scene.add.zone(x, y, size, size).setDepth(CONTROL_DEPTH + 2).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", onDown);
    return zone;
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.isJoystickStart(pointer.x, pointer.y)) {
      return;
    }

    this.joystickPointer = pointer;
    this.captureControlPointer(pointer);
    this.markActive();
    this.updateJoystick(pointer);
    this.base.setFillStyle(0x1e293b, 0.62);
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer !== this.joystickPointer) {
      return;
    }

    this.markActive();
    this.updateJoystick(pointer);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer === this.joystickPointer) {
      this.joystickPointer = undefined;
      this.movementState.x = 0;
      this.movementState.y = 0;
      this.thumb.setPosition(JOYSTICK_CENTER.x, JOYSTICK_CENTER.y);
      this.base.setFillStyle(0x0f172a, 0.48);
    }

    if (pointer === this.firePointer) {
      this.firePointer = undefined;
      this.setButtonPressed(this.fireButton, false, 0xef4444);
    }

    this.controlPointers.delete(pointer);
  }

  private updateJoystick(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - JOYSTICK_CENTER.x;
    const dy = pointer.y - JOYSTICK_CENTER.y;
    const distance = Math.hypot(dx, dy);
    const clampedDistance = Math.min(distance, JOYSTICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    const thumbX = JOYSTICK_CENTER.x + Math.cos(angle) * clampedDistance;
    const thumbY = JOYSTICK_CENTER.y + Math.sin(angle) * clampedDistance;
    const normalizedX = distance === 0 ? 0 : (Math.cos(angle) * clampedDistance) / JOYSTICK_RADIUS;
    const normalizedY = distance === 0 ? 0 : (Math.sin(angle) * clampedDistance) / JOYSTICK_RADIUS;

    this.thumb.setPosition(thumbX, thumbY);
    this.movementState.x = Math.abs(normalizedX) < 0.08 ? 0 : normalizedX;
    this.movementState.y = Math.abs(normalizedY) < 0.08 ? 0 : normalizedY;
  }

  private isJoystickStart(x: number, y: number): boolean {
    return x <= 240 && y >= GAME_HEIGHT - 220 && Phaser.Math.Distance.Between(x, y, JOYSTICK_CENTER.x, JOYSTICK_CENTER.y) <= 112;
  }

  private captureControlPointer(pointer: Phaser.Input.Pointer): void {
    this.controlPointers.add(pointer);
  }

  private markActive(): void {
    this.lastActiveAt = this.scene.time.now;
  }

  private setButtonPressed(button: RoundButton, pressed: boolean, color: number): void {
    button.body.setFillStyle(pressed ? color : 0x0f172a, pressed ? 0.74 : 0.54);
    button.body.setScale(pressed ? 0.94 : 1);
    button.label.setScale(pressed ? 0.94 : 1);
  }

  private pulseButton(button: RoundButton, color: number): void {
    this.setButtonPressed(button, true, color);
    this.scene.time.delayedCall(110, () => {
      this.setButtonPressed(button, false, color);
    });
  }
}
