import type { GameType } from "./types/index.js";

export type GamePlayerLimits = {
  min: number;
  max: number;
  exact?: number;
};

const GAME_LIMITS: Record<GameType, GamePlayerLimits> = {
  chess: { min: 2, max: 2, exact: 2 },
  checkers: { min: 2, max: 2, exact: 2 },
  durak: { min: 2, max: 4 },
  alias: { min: 4, max: 12 },
  mafia: { min: 6, max: 15 }
};

export function getGamePlayerLimits(gameType: GameType): GamePlayerLimits {
  return GAME_LIMITS[gameType];
}

export function gamePlayerCountMessage(gameType: GameType): string {
  switch (gameType) {
    case "chess":
      return "Chess requires exactly 2 players. Please adjust player count.";
    case "checkers":
      return "Checkers requires exactly 2 players. Please adjust player count.";
    case "durak":
      return "Durak supports 2 to 4 players. Please adjust player count.";
    case "alias":
      return "Alias requires 4 to 12 players. Please adjust player count.";
    case "mafia":
      return "Mafia requires 6 to 15 players. Please adjust player count.";
    default:
      return "Invalid player count for selected game.";
  }
}

export function validateGamePlayerCount(gameType: GameType, count: number): { ok: boolean; message?: string } {
  const limits = getGamePlayerLimits(gameType);
  if (limits.exact !== undefined && count !== limits.exact) {
    return { ok: false, message: gamePlayerCountMessage(gameType) };
  }
  if (count < limits.min || count > limits.max) {
    return { ok: false, message: gamePlayerCountMessage(gameType) };
  }
  return { ok: true };
}
