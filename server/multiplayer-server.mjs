import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const MAX_PLAYERS = 8;
const MIN_PLAYERS_TO_START = 2;
const LOBBY_WAIT_MS = 30_000;
const COUNTDOWN_MS = 3_000;
const TICK_MS = 50;
const ARENA = { x: 48, y: 64, width: 864, height: 420 };
const SAFE_ZONE_CENTER = { x: 480, y: 274 };
const PLAYER_RADIUS = 18;
const PLAYER_SPEED = 230;
const PLAYER_HEALTH = 100;
const PLAYER_SHIELD = 50;
const SHOT_COOLDOWN_MS = 360;
const BULLET_SPEED = 610;
const BULLET_RANGE = 390;
const BULLET_DAMAGE = 16;
const BULLET_RADIUS = 4;
const DAMAGE_SCORE_MULTIPLIER = 1.2;
const KILL_SCORE_BONUS = 50;
const LAST_SURVIVOR_SCORE_BONUS = 50;
const COIN_SCORE_DIVISOR = 15;
const ZONE_DAMAGE_PER_SECOND = 7;
const SAFE_ZONE_PHASES = [
  { startAt: 0, endAt: 16, fromRadius: 480, toRadius: 480 },
  { startAt: 16, endAt: 46, fromRadius: 480, toRadius: 280 },
  { startAt: 46, endAt: 78, fromRadius: 280, toRadius: 170 },
  { startAt: 78, endAt: 110, fromRadius: 170, toRadius: 92 }
];

const clients = new Set();
const room = {
  phase: "lobby",
  lobbyStartedAt: Date.now(),
  countdownStartedAt: 0,
  matchStartedAt: 0,
  players: new Map(),
  bullets: [],
  endedAt: 0
};

const server = createServer((request, response) => {
  response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  response.end("Arena Zone multiplayer server is running.\n");
});

server.on("upgrade", (request, socket) => {
  const key = request.headers["sec-websocket-key"];

  if (typeof key !== "string") {
    socket.destroy();
    return;
  }

  const accept = createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "",
      ""
    ].join("\r\n")
  );

  const client = createClient(socket);
  clients.add(client);
});

server.listen(PORT, HOST, () => {
  console.log(`Arena Zone multiplayer server listening on ws://${HOST}:${PORT}`);
});

setInterval(updateRoom, TICK_MS);
setInterval(broadcastLobby, 500);

function createClient(socket) {
  const client = {
    id: randomUUID().slice(0, 8),
    socket,
    buffer: Buffer.alloc(0),
    joined: false,
    send(message) {
      if (socket.destroyed) {
        return;
      }

      socket.write(encodeFrame(JSON.stringify(message)));
    },
    close() {
      socket.end();
    }
  };

  socket.on("data", (chunk) => {
    client.buffer = Buffer.concat([client.buffer, chunk]);
    readFrames(client);
  });

  socket.on("close", () => removeClient(client));
  socket.on("error", () => removeClient(client));

  return client;
}

function readFrames(client) {
  while (client.buffer.length >= 2) {
    const first = client.buffer[0];
    const second = client.buffer[1];
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let payloadLength = second & 0x7f;
    let offset = 2;

    if (payloadLength === 126) {
      if (client.buffer.length < offset + 2) {
        return;
      }

      payloadLength = client.buffer.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLength === 127) {
      if (client.buffer.length < offset + 8) {
        return;
      }

      const high = client.buffer.readUInt32BE(offset);
      const low = client.buffer.readUInt32BE(offset + 4);
      payloadLength = high * 2 ** 32 + low;
      offset += 8;
    }

    const maskLength = masked ? 4 : 0;
    const frameLength = offset + maskLength + payloadLength;

    if (client.buffer.length < frameLength) {
      return;
    }

    const mask = masked ? client.buffer.subarray(offset, offset + 4) : undefined;
    offset += maskLength;
    const payload = client.buffer.subarray(offset, offset + payloadLength);
    client.buffer = client.buffer.subarray(frameLength);

    if (opcode === 0x8) {
      client.close();
      return;
    }

    if (opcode !== 0x1) {
      continue;
    }

    const unmasked = Buffer.alloc(payload.length);
    for (let index = 0; index < payload.length; index += 1) {
      unmasked[index] = mask ? payload[index] ^ mask[index % 4] : payload[index];
    }

    handleClientMessage(client, unmasked.toString("utf8"));
  }
}

function encodeFrame(text) {
  const payload = Buffer.from(text, "utf8");

  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  }

  if (payload.length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeUInt32BE(0, 2);
  header.writeUInt32BE(payload.length, 6);
  return Buffer.concat([header, payload]);
}

function handleClientMessage(client, rawMessage) {
  let message;

  try {
    message = JSON.parse(rawMessage);
  } catch {
    return;
  }

  if (message.type === "join") {
    joinRoom(client, message);
    return;
  }

  if (message.type === "input") {
    updatePlayerInput(client.id, message);
  }
}

function joinRoom(client, message) {
  if (room.phase === "ended" && Date.now() - room.endedAt > 3500) {
    resetRoom();
  }

  if (room.phase !== "lobby" || room.players.size >= MAX_PLAYERS) {
    client.send({ type: "error", message: "A match is already running. Try again after it ends." });
    return;
  }

  const spawn = getSpawnPoint([...room.players.values()]);
  const player = {
    id: client.id,
    name: sanitizeName(message.name),
    color: sanitizeColor(message.color),
    x: spawn.x,
    y: spawn.y,
    aimAngle: 0,
    moveX: 0,
    moveY: 0,
    fire: false,
    health: PLAYER_HEALTH,
    maxHealth: PLAYER_HEALTH,
    shield: PLAYER_SHIELD,
    maxShield: PLAYER_SHIELD,
    score: 0,
    coinsEarned: 0,
    kills: 0,
    alive: true,
    eliminatedAt: undefined,
    lastShotAt: 0
  };

  client.joined = true;
  room.players.set(client.id, player);
  client.send({ type: "joined", id: client.id });
  broadcastLobby();

  if (room.players.size >= MAX_PLAYERS) {
    beginCountdown();
  }
}

function updatePlayerInput(id, message) {
  const player = room.players.get(id);

  if (!player || !player.alive) {
    return;
  }

  player.moveX = clampNumber(message.moveX, -1, 1);
  player.moveY = clampNumber(message.moveY, -1, 1);
  player.aimAngle = clampNumber(message.aimAngle, -Math.PI * 2, Math.PI * 2);
  player.fire = Boolean(message.fire);
}

function removeClient(client) {
  clients.delete(client);
  const player = room.players.get(client.id);

  if (player && room.phase === "match") {
    eliminatePlayer(player);
    maybeEndMatch();
  } else {
    room.players.delete(client.id);
    broadcastLobby();
  }
}

function updateRoom() {
  const now = Date.now();

  if (room.phase === "lobby" && now - room.lobbyStartedAt >= LOBBY_WAIT_MS) {
    if (room.players.size >= MIN_PLAYERS_TO_START) {
      beginCountdown();
    } else {
      room.lobbyStartedAt = now - LOBBY_WAIT_MS + 5000;
      broadcastLobby();
    }
    return;
  }

  if (room.phase === "countdown" && now - room.countdownStartedAt >= COUNTDOWN_MS) {
    startMatch();
    return;
  }

  if (room.phase !== "match") {
    return;
  }

  updatePlayers(TICK_MS / 1000);
  updateBullets(TICK_MS / 1000);
  applyZoneDamage(TICK_MS / 1000);
  maybeEndMatch();
  broadcastSnapshot();
}

function beginCountdown() {
  if (room.phase !== "lobby") {
    return;
  }

  room.phase = "countdown";
  room.countdownStartedAt = Date.now();
  broadcastLobby();
}

function startMatch() {
  if (room.phase !== "countdown") {
    return;
  }

  if (room.players.size < MIN_PLAYERS_TO_START) {
    room.phase = "lobby";
    room.lobbyStartedAt = Date.now() - LOBBY_WAIT_MS + 5000;
    room.countdownStartedAt = 0;
    broadcastLobby();
    return;
  }

  room.phase = "match";
  room.matchStartedAt = Date.now();
  room.bullets.length = 0;
  broadcastLobby();
  broadcastSnapshot();
}

function resetRoom() {
  room.phase = "lobby";
  room.lobbyStartedAt = Date.now();
  room.countdownStartedAt = 0;
  room.matchStartedAt = 0;
  room.bullets.length = 0;
  room.endedAt = 0;

  for (const client of [...clients]) {
    if (!client.joined) {
      continue;
    }

    client.joined = false;
  }

  room.players.clear();
}

function updatePlayers(deltaSeconds) {
  for (const player of room.players.values()) {
    if (!player.alive) {
      continue;
    }

    const length = Math.hypot(player.moveX, player.moveY);
    const moveX = length > 0 ? player.moveX / length : 0;
    const moveY = length > 0 ? player.moveY / length : 0;
    player.x = clamp(player.x + moveX * PLAYER_SPEED * deltaSeconds, ARENA.x + PLAYER_RADIUS, ARENA.x + ARENA.width - PLAYER_RADIUS);
    player.y = clamp(player.y + moveY * PLAYER_SPEED * deltaSeconds, ARENA.y + PLAYER_RADIUS, ARENA.y + ARENA.height - PLAYER_RADIUS);

    if (player.fire) {
      fireBullet(player);
    }
  }
}

function fireBullet(player) {
  const now = Date.now();

  if (now - player.lastShotAt < SHOT_COOLDOWN_MS) {
    return;
  }

  player.lastShotAt = now;
  room.bullets.push({
    id: randomUUID().slice(0, 10),
    ownerId: player.id,
    x: player.x + Math.cos(player.aimAngle) * 52,
    y: player.y + Math.sin(player.aimAngle) * 52,
    vx: Math.cos(player.aimAngle) * BULLET_SPEED,
    vy: Math.sin(player.aimAngle) * BULLET_SPEED,
    distance: 0,
    color: 0xfef08a,
    radius: BULLET_RADIUS
  });
}

function updateBullets(deltaSeconds) {
  for (let index = room.bullets.length - 1; index >= 0; index -= 1) {
    const bullet = room.bullets[index];
    const moveX = bullet.vx * deltaSeconds;
    const moveY = bullet.vy * deltaSeconds;
    bullet.x += moveX;
    bullet.y += moveY;
    bullet.distance += Math.hypot(moveX, moveY);

    if (bullet.distance >= BULLET_RANGE || isOutsideArena(bullet.x, bullet.y)) {
      room.bullets.splice(index, 1);
      continue;
    }

    const hit = findHitPlayer(bullet);

    if (!hit) {
      continue;
    }

    applyDamage(hit, BULLET_DAMAGE, bullet.ownerId);
    room.bullets.splice(index, 1);
  }
}

function applyDamage(player, amount, attackerId) {
  if (!player.alive) {
    return;
  }

  const shieldBefore = player.shield;
  player.shield = Math.max(0, player.shield - amount);
  const absorbed = shieldBefore - player.shield;
  const healthBefore = player.health;
  player.health = Math.max(0, player.health - (amount - absorbed));
  const totalApplied = absorbed + (healthBefore - player.health);
  const attacker = room.players.get(attackerId);

  if (attacker && attacker.id !== player.id) {
    attacker.score += Math.round(totalApplied * DAMAGE_SCORE_MULTIPLIER);
  }

  if (player.health <= 0) {
    eliminatePlayer(player);

    if (attacker && attacker.id !== player.id) {
      attacker.kills += 1;
      attacker.score += KILL_SCORE_BONUS;
    }
  }
}

function applyZoneDamage(deltaSeconds) {
  const radius = getSafeZoneRadius();

  for (const player of room.players.values()) {
    if (!player.alive) {
      continue;
    }

    if (distance(player.x, player.y, SAFE_ZONE_CENTER.x, SAFE_ZONE_CENTER.y) <= radius) {
      continue;
    }

    applyDamage(player, ZONE_DAMAGE_PER_SECOND * deltaSeconds, undefined);
  }
}

function eliminatePlayer(player) {
  if (!player.alive) {
    return;
  }

  player.alive = false;
  player.eliminatedAt = Date.now();
  player.moveX = 0;
  player.moveY = 0;
  player.fire = false;
}

function maybeEndMatch() {
  if (room.phase !== "match") {
    return;
  }

  const alivePlayers = [...room.players.values()].filter((player) => player.alive);

  if (alivePlayers.length > 1) {
    return;
  }

  if (alivePlayers[0]) {
    alivePlayers[0].score += LAST_SURVIVOR_SCORE_BONUS;
  }

  const survivalSeconds = getElapsedSeconds();
  const standings = [...room.players.values()]
    .map((player) => {
      const score = Math.max(0, Math.round(player.score));
      return {
        id: player.id,
        name: player.name,
        score,
        coinsEarned: Math.max(0, Math.floor(score / COIN_SCORE_DIVISOR)),
        eliminated: !player.alive
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (a.eliminated !== b.eliminated) {
        return a.eliminated ? 1 : -1;
      }

      return a.name.localeCompare(b.name);
    })
    .map((standing, index) => ({ ...standing, position: index + 1 }));

  room.phase = "ended";
  room.endedAt = Date.now();
  broadcast({ type: "matchEnded", standings, survivalSeconds });
}

function broadcastLobby() {
  if (room.phase === "match" || room.phase === "ended") {
    return;
  }

  const now = Date.now();
  const startsInMs =
    room.phase === "countdown"
      ? Math.max(0, COUNTDOWN_MS - (now - room.countdownStartedAt))
      : Math.max(0, LOBBY_WAIT_MS - (now - room.lobbyStartedAt));

  broadcast({
    type: "lobby",
    phase: room.phase,
    players: [...room.players.values()].map(toLobbyPlayer),
    maxPlayers: MAX_PLAYERS,
    startsInMs,
    countdownMs: room.phase === "countdown" ? startsInMs : COUNTDOWN_MS
  });
}

function broadcastSnapshot() {
  broadcast({
    type: "snapshot",
    players: [...room.players.values()].map(toSnapshotPlayer),
    bullets: room.bullets.map((bullet) => ({
      id: bullet.id,
      x: bullet.x,
      y: bullet.y,
      color: bullet.color,
      radius: bullet.radius
    })),
    elapsedSeconds: getElapsedSeconds(),
    safeZoneRadius: getSafeZoneRadius()
  });
}

function broadcast(message) {
  for (const client of clients) {
    if (client.joined) {
      client.send(message);
    }
  }
}

function toLobbyPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    x: Math.round(player.x),
    y: Math.round(player.y)
  };
}

function toSnapshotPlayer(player) {
  return {
    ...toLobbyPlayer(player),
    aimAngle: player.aimAngle,
    moveX: player.moveX,
    moveY: player.moveY,
    health: Math.round(player.health),
    maxHealth: player.maxHealth,
    shield: Math.round(player.shield),
    maxShield: player.maxShield,
    score: Math.round(player.score),
    coinsEarned: Math.max(0, Math.floor(Math.max(0, player.score) / COIN_SCORE_DIVISOR)),
    kills: player.kills,
    alive: player.alive
  };
}

function findHitPlayer(bullet) {
  for (const player of room.players.values()) {
    if (!player.alive || player.id === bullet.ownerId) {
      continue;
    }

    if (distance(player.x, player.y, bullet.x, bullet.y) <= PLAYER_RADIUS + bullet.radius) {
      return player;
    }
  }

  return undefined;
}

function getSpawnPoint(existingPlayers) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const point = {
      x: randomInt(ARENA.x + 76, ARENA.x + ARENA.width - 76),
      y: randomInt(ARENA.y + 76, ARENA.y + ARENA.height - 76)
    };

    if (existingPlayers.every((player) => distance(player.x, player.y, point.x, point.y) >= 132)) {
      return point;
    }
  }

  return {
    x: randomInt(ARENA.x + 76, ARENA.x + ARENA.width - 76),
    y: randomInt(ARENA.y + 76, ARENA.y + ARENA.height - 76)
  };
}

function getSafeZoneRadius() {
  const elapsedSeconds = getElapsedSeconds();
  const phase = SAFE_ZONE_PHASES.find((candidate) => elapsedSeconds >= candidate.startAt && elapsedSeconds < candidate.endAt) ?? SAFE_ZONE_PHASES[SAFE_ZONE_PHASES.length - 1];
  const progress = clamp((elapsedSeconds - phase.startAt) / Math.max(1, phase.endAt - phase.startAt), 0, 1);
  return phase.fromRadius + (phase.toRadius - phase.fromRadius) * progress;
}

function getElapsedSeconds() {
  if (!room.matchStartedAt) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - room.matchStartedAt) / 1000));
}

function isOutsideArena(x, y) {
  return x < ARENA.x - 8 || x > ARENA.x + ARENA.width + 8 || y < ARENA.y - 8 || y > ARENA.y + ARENA.height + 8;
}

function sanitizeName(name) {
  return String(name || "Player")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 14) || "Player";
}

function sanitizeColor(color) {
  const parsed = Number(color);
  return Number.isFinite(parsed) ? Math.trunc(parsed) & 0xffffff : 0x39c6f0;
}

function clampNumber(value, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}
