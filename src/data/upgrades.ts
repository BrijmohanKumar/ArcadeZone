export type UpgradeId = "healthBoost" | "shieldBoost" | "ammoEfficiency";

export type UpgradeDefinition = {
  id: UpgradeId;
  name: string;
  description: string;
  baseCost: number;
  costStep: number;
};

export const UPGRADE_DEFINITIONS: UpgradeDefinition[] = [
  {
    id: "healthBoost",
    name: "Health Boost",
    description: "+1 max health per level.",
    baseCost: 100,
    costStep: 10
  },
  {
    id: "shieldBoost",
    name: "Shield Boost",
    description: "+1 max shield per level.",
    baseCost: 100,
    costStep: 10
  },
  {
    id: "ammoEfficiency",
    name: "Ammo Efficiency",
    description: "+1 efficiency level. Higher levels preserve more ammo.",
    baseCost: 100,
    costStep: 10
  }
];

export function getUpgradeCost(upgrade: UpgradeDefinition, currentLevel: number): number {
  return upgrade.baseCost + currentLevel * upgrade.costStep;
}

export function getAmmoPreserveChance(level: number): number {
  return 1 - Math.pow(0.95, Math.max(0, level));
}
