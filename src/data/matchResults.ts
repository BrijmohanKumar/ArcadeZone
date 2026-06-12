export type MatchStanding = {
  position: number;
  name: string;
  score: number;
  coinsEarned: number;
  eliminated: boolean;
  isPlayer?: boolean;
};

export type MatchResultData = {
  won: boolean;
  reason: "victory" | "eliminated";
  placement: number;
  playerCount: number;
  score: number;
  baseScore: number;
  survivalBonus: number;
  winBonus: number;
  coinsEarned: number;
  totalCoins: number;
  kills: number;
  damageDealt: number;
  survivalSeconds: number;
  armorShards: number;
  coinShards: number;
  bestScore: number;
  totalMatches: number;
  totalWins: number;
  standings: MatchStanding[];
};

export const DEFAULT_MATCH_RESULT: MatchResultData = {
  won: false,
  reason: "eliminated",
  placement: 1,
  playerCount: 1,
  score: 0,
  baseScore: 0,
  survivalBonus: 0,
  winBonus: 0,
  coinsEarned: 0,
  totalCoins: 0,
  kills: 0,
  damageDealt: 0,
  survivalSeconds: 0,
  armorShards: 0,
  coinShards: 0,
  bestScore: 0,
  totalMatches: 0,
  totalWins: 0,
  standings: []
};
