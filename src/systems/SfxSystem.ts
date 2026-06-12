import type Phaser from "phaser";
import { playablesBridge } from "../platform/PlayablesBridge";

export type SfxName =
  | "ui"
  | "countdown"
  | "start"
  | "shoot"
  | "shootHeavy"
  | "botShoot"
  | "empty"
  | "hit"
  | "enemyDown"
  | "explosion"
  | "playerHit"
  | "zone"
  | "pickup"
  | "recharge"
  | "switch"
  | "victory"
  | "defeat";

type WindowWithWebAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const STORAGE_KEY = "arena-drop-sfx-muted";

class SfxSystem {
  private context?: AudioContext;
  private muted = this.readMutedState();
  private platformAudioEnabled = true;
  private platformAudioRegistered = false;
  private readonly lastPlayedAt = new Map<SfxName, number>();
  private lobbyMusicEvent?: Phaser.Time.TimerEvent;
  private lobbyMusicStep = 0;

  registerScene(scene: Phaser.Scene): void {
    this.registerPlatformAudio();

    scene.input.once("pointerdown", () => {
      void this.unlock();
    });
    scene.input.keyboard?.once("keydown", () => {
      void this.unlock();
    });
  }

  get isMuted(): boolean {
    return this.muted || !this.platformAudioEnabled;
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    this.writeMutedState();

    if (this.isMuted) {
      this.stopLobbyMusic();
      return this.muted;
    }

    void this.unlock();
    this.play("ui");
    return this.muted;
  }

  startLobbyMusic(scene: Phaser.Scene): void {
    if (this.isMuted || typeof window === "undefined") {
      this.stopLobbyMusic();
      return;
    }

    const context = this.getContext();

    if (!context) {
      return;
    }

    this.stopLobbyMusic();
    this.lobbyMusicStep = 0;

    if (context.state === "suspended") {
      void this.unlock();
    }

    this.playLobbyMusicStep();
    this.lobbyMusicEvent = scene.time.addEvent({
      delay: 420,
      loop: true,
      callback: () => this.playLobbyMusicStep()
    });
  }

  stopLobbyMusic(): void {
    this.lobbyMusicEvent?.remove(false);
    this.lobbyMusicEvent = undefined;
  }

  setMuted(muted: boolean): boolean {
    if (this.muted === muted) {
      return this.muted;
    }

    this.muted = muted;
    this.writeMutedState();

    if (!this.isMuted) {
      void this.unlock();
      this.play("ui");
    } else {
      this.stopLobbyMusic();
    }

    return this.muted;
  }

  async unlock(): Promise<void> {
    if (this.isMuted) {
      return;
    }

    const context = this.getContext();

    if (!context || context.state !== "suspended") {
      return;
    }

    try {
      await context.resume();
    } catch {
      // Browsers can deny resume until the next trusted user gesture.
    }
  }

  play(name: SfxName, intensity = 1): void {
    if (this.isMuted || typeof window === "undefined") {
      return;
    }

    const context = this.getContext();

    if (!context) {
      return;
    }

    if (context.state === "suspended") {
      void this.unlock();
    }

    if (this.isThrottled(name, context.currentTime)) {
      return;
    }

    const volume = Math.min(Math.max(intensity, 0.2), 1.4);

    switch (name) {
      case "ui":
        this.tone(360, 0.045, 0.04 * volume, "triangle");
        break;
      case "countdown":
        this.tone(640, 0.09, 0.08 * volume, "sine", 0, 720);
        break;
      case "start":
        this.tone(430, 0.08, 0.08 * volume, "triangle");
        this.tone(860, 0.14, 0.07 * volume, "triangle", 0.07);
        break;
      case "shoot":
        this.noise(0.045, 0.035 * volume);
        this.tone(520, 0.04, 0.035 * volume, "square", 0, 340);
        break;
      case "shootHeavy":
        this.noise(0.09, 0.06 * volume);
        this.tone(210, 0.075, 0.065 * volume, "sawtooth", 0, 120);
        break;
      case "botShoot":
        this.noise(0.04, 0.02 * volume);
        this.tone(250, 0.045, 0.025 * volume, "square", 0, 180);
        break;
      case "empty":
        this.tone(120, 0.045, 0.035 * volume, "square");
        break;
      case "hit":
        this.tone(190, 0.055, 0.045 * volume, "square", 0, 110);
        break;
      case "enemyDown":
        this.tone(260, 0.08, 0.055 * volume, "sawtooth", 0, 130);
        this.tone(520, 0.1, 0.04 * volume, "triangle", 0.07);
        break;
      case "explosion":
        this.noise(0.18, 0.09 * volume);
        this.tone(88, 0.16, 0.08 * volume, "sawtooth", 0, 44);
        this.tone(46, 0.24, 0.06 * volume, "sawtooth", 0.04, 32);
        break;
      case "playerHit":
        this.noise(0.1, 0.055 * volume);
        this.tone(90, 0.1, 0.05 * volume, "sawtooth", 0, 65);
        break;
      case "zone":
        this.tone(75, 0.12, 0.04 * volume, "sawtooth", 0, 55);
        break;
      case "pickup":
        this.tone(520, 0.055, 0.045 * volume, "triangle");
        this.tone(840, 0.08, 0.045 * volume, "triangle", 0.045);
        break;
      case "recharge":
        this.tone(620, 0.06, 0.04 * volume, "sine");
        this.tone(930, 0.07, 0.035 * volume, "sine", 0.045);
        this.tone(1240, 0.09, 0.03 * volume, "sine", 0.09);
        break;
      case "switch":
        this.tone(420, 0.055, 0.04 * volume, "triangle", 0, 520);
        break;
      case "victory":
        this.tone(440, 0.12, 0.055 * volume, "triangle");
        this.tone(660, 0.14, 0.055 * volume, "triangle", 0.1);
        this.tone(880, 0.18, 0.05 * volume, "triangle", 0.22);
        break;
      case "defeat":
        this.tone(260, 0.13, 0.055 * volume, "sawtooth");
        this.tone(170, 0.2, 0.05 * volume, "sawtooth", 0.12);
        break;
    }
  }

  private getContext(): AudioContext | undefined {
    if (this.context) {
      return this.context;
    }

    const AudioCtor = window.AudioContext ?? (window as WindowWithWebAudio).webkitAudioContext;

    if (!AudioCtor) {
      return undefined;
    }

    this.context = new AudioCtor();
    return this.context;
  }

  private tone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    delay = 0,
    endFrequency?: number
  ): void {
    const context = this.context;

    if (!context) {
      return;
    }

    const startAt = context.currentTime + delay;
    const endAt = startAt + duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);

    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), endAt);
    }

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startAt + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(endAt + 0.03);
  }

  private noise(duration: number, volume: number, delay = 0): void {
    const context = this.context;

    if (!context) {
      return;
    }

    const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < sampleCount; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
    }

    const startAt = context.currentTime + delay;
    const source = context.createBufferSource();
    const gain = context.createGain();

    source.buffer = buffer;
    gain.gain.setValueAtTime(Math.max(0.0001, volume), startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    source.connect(gain);
    gain.connect(context.destination);
    source.start(startAt);
  }

  private playLobbyMusicStep(): void {
    if (this.isMuted) {
      this.stopLobbyMusic();
      return;
    }

    const context = this.getContext();

    if (!context) {
      return;
    }

    if (context.state === "suspended") {
      void this.unlock();
    }

    const notes = [196, 246.94, 293.66, 329.63, 293.66, 246.94, 220, 246.94];
    const step = this.lobbyMusicStep % notes.length;
    const note = notes[step];

    this.tone(note, 0.18, 0.018, "triangle");
    this.tone(note * 2, 0.11, 0.01, "sine", 0.04);

    if (step % 4 === 0) {
      this.tone(98, 0.3, 0.022, "sawtooth");
    }

    if (step === 7) {
      this.tone(392, 0.14, 0.012, "triangle", 0.16);
    }

    this.lobbyMusicStep += 1;
  }

  private isThrottled(name: SfxName, now: number): boolean {
    const minGap =
      name === "botShoot" ? 0.09 : name === "zone" ? 0.45 : name === "shoot" ? 0.035 : name === "explosion" ? 0.12 : 0.02;
    const previous = this.lastPlayedAt.get(name) ?? Number.NEGATIVE_INFINITY;

    if (now - previous < minGap) {
      return true;
    }

    this.lastPlayedAt.set(name, now);
    return false;
  }

  private readMutedState(): boolean {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  private writeMutedState(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, this.muted ? "1" : "0");
    } catch {
      // Local storage is optional for YouTube Playables-style embeds.
    }
  }

  private registerPlatformAudio(): void {
    if (this.platformAudioRegistered) {
      return;
    }

    this.platformAudioRegistered = true;
    this.platformAudioEnabled = playablesBridge.isAudioEnabled();
    playablesBridge.onAudioEnabledChange((enabled) => {
      this.platformAudioEnabled = enabled;

      if (!enabled) {
        this.stopLobbyMusic();
      }
    });
  }
}

export const sfxSystem = new SfxSystem();
