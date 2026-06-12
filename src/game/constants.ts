export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const ARENA_BOUNDS = {
  x: 48,
  y: 64,
  width: GAME_WIDTH - 96,
  height: GAME_HEIGHT - 120
} as const;

export const SceneKeys = {
  Boot: "BootScene",
  Menu: "MenuScene",
  Lobby: "LobbyScene",
  HowToPlay: "HowToPlayScene",
  Upgrades: "UpgradeScene",
  Settings: "SettingsScene",
  Match: "MatchScene",
  Results: "ResultsScene"
} as const;

export const Palette = {
  background: 0x0b1020,
  panel: 0x182033,
  panelLight: 0x25314d,
  text: "#f8fafc",
  mutedText: "#9aa8c7",
  accent: 0x28d39b,
  accentDark: 0x14966d,
  danger: 0xef4444,
  warning: 0xf59e0b,
  arena: 0x26344f,
  arenaLine: 0x58709e,
  player: 0x39c6f0,
  playerDark: 0x137c9d,
  aim: 0xb7f7ff
} as const;
