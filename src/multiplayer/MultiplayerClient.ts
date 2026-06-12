export type MultiplayerLobbyPlayer = {
  id: string;
  name: string;
  color: number;
  x: number;
  y: number;
};

export type MultiplayerLobbyState = {
  type: "lobby";
  phase: "lobby" | "countdown" | "match" | "ended";
  players: MultiplayerLobbyPlayer[];
  maxPlayers: number;
  startsInMs: number;
  countdownMs: number;
};

export type MultiplayerSnapshotPlayer = MultiplayerLobbyPlayer & {
  aimAngle: number;
  moveX: number;
  moveY: number;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  score: number;
  coinsEarned: number;
  kills: number;
  alive: boolean;
};

export type MultiplayerSnapshotBullet = {
  id: string;
  x: number;
  y: number;
  color: number;
  radius: number;
};

export type MultiplayerSnapshot = {
  type: "snapshot";
  players: MultiplayerSnapshotPlayer[];
  bullets: MultiplayerSnapshotBullet[];
  elapsedSeconds: number;
  safeZoneRadius: number;
};

export type MultiplayerStanding = {
  id: string;
  name: string;
  position: number;
  score: number;
  coinsEarned: number;
  eliminated: boolean;
};

export type MultiplayerMatchEnded = {
  type: "matchEnded";
  standings: MultiplayerStanding[];
  survivalSeconds: number;
};

type MultiplayerServerMessage = MultiplayerLobbyState | MultiplayerSnapshot | MultiplayerMatchEnded | { type: "joined"; id: string } | { type: "error"; message: string };

type MultiplayerEventMap = {
  lobby: MultiplayerLobbyState;
  snapshot: MultiplayerSnapshot;
  matchEnded: MultiplayerMatchEnded;
  error: string;
  close: void;
};

type MultiplayerHandler<K extends keyof MultiplayerEventMap> = (payload: MultiplayerEventMap[K]) => void;

export type MultiplayerInputPayload = {
  moveX: number;
  moveY: number;
  aimAngle: number;
  fire: boolean;
};

const CONNECT_TIMEOUT_MS = 2600;

export class MultiplayerClient {
  private socket?: WebSocket;
  private readonly listeners = new Map<keyof MultiplayerEventMap, Set<(payload: unknown) => void>>();
  readonly url: string;
  playerId = "";
  lastLobbyState?: MultiplayerLobbyState;
  lastSnapshot?: MultiplayerSnapshot;
  lastMatchEnded?: MultiplayerMatchEnded;

  constructor(url: string) {
    this.url = url;
  }

  static getRequestedUrl(): string | undefined {
    const searchParams = new URLSearchParams(window.location.search);
    const requested = searchParams.get("mp");

    if (!requested || requested === "0" || requested === "false") {
      return undefined;
    }

    if (requested.startsWith("ws://") || requested.startsWith("wss://")) {
      return requested;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname || "127.0.0.1";
    return `${protocol}//${host}:8787`;
  }

  async connect(player: { name: string; color: number }): Promise<boolean> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return true;
    }

    return new Promise((resolve) => {
      let settled = false;
      const socket = new WebSocket(this.url);
      this.socket = socket;
      const timeout = window.setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        socket.close();
        this.emit("error", "Multiplayer server did not respond.");
        resolve(false);
      }, CONNECT_TIMEOUT_MS);

      socket.addEventListener("open", () => {
        this.send({ type: "join", name: player.name, color: player.color });
      });

      socket.addEventListener("message", (event) => {
        this.handleMessage(event.data);

        if (!settled && this.playerId) {
          settled = true;
          window.clearTimeout(timeout);
          resolve(true);
        }
      });

      socket.addEventListener("error", () => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timeout);
          this.emit("error", "Multiplayer server connection failed.");
          resolve(false);
        }
      });

      socket.addEventListener("close", () => {
        window.clearTimeout(timeout);
        this.emit("close", undefined);

        if (!settled) {
          settled = true;
          resolve(false);
        }
      });
    });
  }

  on<K extends keyof MultiplayerEventMap>(event: K, handler: MultiplayerHandler<K>): () => void {
    const handlers = this.listeners.get(event) ?? new Set<(payload: unknown) => void>();
    handlers.add(handler as (payload: unknown) => void);
    this.listeners.set(event, handlers);

    return () => {
      handlers.delete(handler as (payload: unknown) => void);
    };
  }

  sendInput(input: MultiplayerInputPayload): void {
    this.send({ type: "input", ...input });
  }

  close(): void {
    this.socket?.close();
    this.socket = undefined;
  }

  private handleMessage(rawData: unknown): void {
    if (typeof rawData !== "string") {
      return;
    }

    let message: MultiplayerServerMessage;

    try {
      message = JSON.parse(rawData) as MultiplayerServerMessage;
    } catch {
      return;
    }

    switch (message.type) {
      case "joined":
        this.playerId = message.id;
        break;
      case "lobby":
        this.lastLobbyState = message;
        this.emit("lobby", message);
        break;
      case "snapshot":
        this.lastSnapshot = message;
        this.emit("snapshot", message);
        break;
      case "matchEnded":
        this.lastMatchEnded = message;
        this.emit("matchEnded", message);
        break;
      case "error":
        this.emit("error", message.message);
        break;
    }
  }

  private send(payload: Record<string, unknown>): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(payload));
  }

  private emit<K extends keyof MultiplayerEventMap>(event: K, payload: MultiplayerEventMap[K]): void {
    this.listeners.get(event)?.forEach((handler) => handler(payload));
  }
}
