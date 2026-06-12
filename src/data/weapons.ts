export type WeaponId = "pistol" | "smg" | "shotgun" | "rifle";

export type WeaponDefinition = {
  id: WeaponId;
  name: string;
  damage: number;
  fireCooldownMs: number;
  bulletSpeed: number;
  range: number;
  ammoCapacity: number;
  spreadRadians: number;
  pellets: number;
  bulletRadius: number;
  bulletColor: number;
};

export const WEAPON_DEFINITIONS: Record<WeaponId, WeaponDefinition> = {
  pistol: {
    id: "pistol",
    name: "Pistol",
    damage: 18,
    fireCooldownMs: 320,
    bulletSpeed: 620,
    range: 470,
    ammoCapacity: 22,
    spreadRadians: 0.035,
    pellets: 1,
    bulletRadius: 4,
    bulletColor: 0xf8fafc
  },
  smg: {
    id: "smg",
    name: "SMG",
    damage: 9,
    fireCooldownMs: 90,
    bulletSpeed: 590,
    range: 360,
    ammoCapacity: 36,
    spreadRadians: 0.12,
    pellets: 1,
    bulletRadius: 3,
    bulletColor: 0x86efac
  },
  shotgun: {
    id: "shotgun",
    name: "Shotgun",
    damage: 10,
    fireCooldownMs: 780,
    bulletSpeed: 540,
    range: 220,
    ammoCapacity: 9,
    spreadRadians: 0.34,
    pellets: 6,
    bulletRadius: 3,
    bulletColor: 0xfbbf24
  },
  rifle: {
    id: "rifle",
    name: "Rifle",
    damage: 24,
    fireCooldownMs: 460,
    bulletSpeed: 760,
    range: 620,
    ammoCapacity: 16,
    spreadRadians: 0.018,
    pellets: 1,
    bulletRadius: 4,
    bulletColor: 0x93c5fd
  }
};
