export type TankSkin = {
  id: string;
  name: string;
  primary: number;
  dark: number;
  turret: number;
  barrel: number;
  track: number;
  glow: number;
  accent: number;
};

export const TANK_SKINS = [
  {
    id: "sky",
    name: "Sky Breaker",
    primary: 0x39c6f0,
    dark: 0x137c9d,
    turret: 0xdbeafe,
    barrel: 0xb7f7ff,
    track: 0x0f172a,
    glow: 0x67e8f9,
    accent: 0x7dd3fc
  },
  {
    id: "ember",
    name: "Ember Core",
    primary: 0xf97316,
    dark: 0x9a3412,
    turret: 0xffedd5,
    barrel: 0xfef3c7,
    track: 0x1f130b,
    glow: 0xfb923c,
    accent: 0xfacc15
  },
  {
    id: "jade",
    name: "Jade Strike",
    primary: 0x22c55e,
    dark: 0x15803d,
    turret: 0xdcfce7,
    barrel: 0xbbf7d0,
    track: 0x081c14,
    glow: 0x34d399,
    accent: 0x86efac
  },
  {
    id: "violet",
    name: "Violet Pulse",
    primary: 0xa78bfa,
    dark: 0x6d28d9,
    turret: 0xede9fe,
    barrel: 0xddd6fe,
    track: 0x171126,
    glow: 0xc4b5fd,
    accent: 0xf0abfc
  },
  {
    id: "crimson",
    name: "Crimson Guard",
    primary: 0xef4444,
    dark: 0x991b1b,
    turret: 0xfee2e2,
    barrel: 0xfecaca,
    track: 0x1f1116,
    glow: 0xf87171,
    accent: 0xfb7185
  },
  {
    id: "gold",
    name: "Gold Vector",
    primary: 0xf59e0b,
    dark: 0x92400e,
    turret: 0xfef3c7,
    barrel: 0xfffbeb,
    track: 0x1f1a0c,
    glow: 0xfbbf24,
    accent: 0xfde68a
  }
] as const satisfies readonly TankSkin[];

export type TankSkinId = (typeof TANK_SKINS)[number]["id"];
export type TankSkinDefinition = (typeof TANK_SKINS)[number];

export const DEFAULT_TANK_SKIN_ID: TankSkinId = "sky";

export function getTankSkin(id: string | undefined): TankSkinDefinition {
  return TANK_SKINS.find((skin) => skin.id === id) ?? TANK_SKINS[0];
}
