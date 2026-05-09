import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AliasMovePayload, AliasServerState, AliasState, GameOverPayload, PlayerInRoom } from "@board-games/shared";

interface EngineResult<TState> {
  ok: boolean;
  state: TState;
  error: string;
  over?: Pick<GameOverPayload, "winnerId" | "reason">;
}

const DEFAULT_POINTS = 20;
const DEFAULT_ROUND_SEC = 60;

function nowIso(): string {
  return new Date().toISOString();
}

function loadWordDeck(): string[] {
  const candidates = [
    join(process.cwd(), "packages", "backend", "dist", "data", "alias-words.json"),
    join(process.cwd(), "packages", "backend", "src", "data", "alias-words.json")
  ];

  for (const filePath of candidates) {
    try {
      const raw = readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed) && parsed.length >= 200) {
        return parsed;
      }
    } catch {
      // Try next path.
    }
  }

  return [
    "planet",
    "forest",
    "camera",
    "ocean",
    "window",
    "bridge",
    "pencil",
    "rocket",
    "turtle",
    "guitar"
  ];
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j] as T;
    result[j] = temp as T;
  }
  return result;
}

function buildTeams(players: PlayerInRoom[]): AliasServerState["teams"] {
  const teamA = {
    id: "team-a",
    name: "Team A",
    playerIds: [] as string[],
    score: 0
  };

  const teamB = {
    id: "team-b",
    name: "Team B",
    playerIds: [] as string[],
    score: 0
  };

  players.forEach((player, index) => {
    if (index % 2 === 0) {
      teamA.playerIds.push(player.userId);
    } else {
      teamB.playerIds.push(player.userId);
    }
  });

  return [teamA, teamB];
}

function drawNextWord(state: AliasServerState): string | null {
  if (state.deck.length === 0 && state.discard.length > 0) {
    state.deck = shuffle(state.discard);
    state.discard = [];
  }

  const word = state.deck.shift() ?? null;
  if (word) {
    state.activeWord = word;
  }
  return word;
}

function endRound(state: AliasServerState): void {
  state.status = "SETUP";
  state.roundEndsAtMs = null;
  state.explainerId = null;
  state.activeWord = null;
  state.currentTeamIndex = (state.currentTeamIndex + 1) % state.teams.length;
  state.currentTeamId = state.teams[state.currentTeamIndex]?.id ?? state.currentTeamId;
}

function ensureRoundActive(state: AliasServerState, nowMs: number): boolean {
  if (state.status !== "ROUND") return false;
  if (!state.roundEndsAtMs) return true;
  if (nowMs <= state.roundEndsAtMs) return true;

  endRound(state);
  return false;
}

export function sanitizeAliasState(state: AliasServerState): AliasState {
  return {
    gameType: "alias",
    teams: state.teams,
    currentTeamId: state.currentTeamId,
    currentTeamIndex: state.currentTeamIndex,
    round: state.round,
    pointsToWin: state.pointsToWin,
    roundDurationSec: state.roundDurationSec,
    roundEndsAtMs: state.roundEndsAtMs,
    explainerId: state.explainerId,
    activeWord: state.activeWord,
    deckCount: state.deck.length,
    discardCount: state.discard.length,
    status: state.status,
    winnerTeamId: state.winnerTeamId,
    reason: state.reason,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt
  };
}

export function createInitialAliasState(players: PlayerInRoom[]): AliasServerState {
  if (players.length < 4) {
    throw new Error("Alias requires at least 4 players");
  }

  const teams = buildTeams(players);
  const deck = shuffle(loadWordDeck());

  return {
    gameType: "alias",
    teams,
    currentTeamId: teams[0]?.id ?? "team-a",
    currentTeamIndex: 0,
    round: 0,
    pointsToWin: DEFAULT_POINTS,
    roundDurationSec: DEFAULT_ROUND_SEC,
    roundEndsAtMs: null,
    explainerId: null,
    activeWord: null,
    deck,
    discard: [],
    status: "SETUP",
    winnerTeamId: null,
    reason: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

export function applyAliasMove(
  state: AliasServerState,
  payload: AliasMovePayload,
  playerId: string,
  nowMs: number
): EngineResult<AliasServerState> {
  if (state.status === "ENDED") {
    return { ok: false, state, error: "Alias game already finished" };
  }

  if (!state.teams.some((team) => team.playerIds.includes(playerId))) {
    return { ok: false, state, error: "Player is not in any Alias team" };
  }

  if (payload.action === "startRound") {
    if (state.status === "ROUND") {
      return { ok: false, state, error: "Alias round already running" };
    }

    const currentTeam = state.teams[state.currentTeamIndex];
    if (!currentTeam || currentTeam.playerIds.length === 0) {
      return { ok: false, state, error: "Alias teams are not configured" };
    }

    state.round += 1;
    const explainerIndex = (state.round - 1) % currentTeam.playerIds.length;
    state.explainerId = currentTeam.playerIds[explainerIndex] ?? currentTeam.playerIds[0];
    state.roundEndsAtMs = nowMs + state.roundDurationSec * 1000;
    state.status = "ROUND";

    const word = drawNextWord(state);
    if (!word) {
      return { ok: false, state, error: "Alias deck is empty" };
    }
  } else if (payload.action === "guess") {
    if (!ensureRoundActive(state, nowMs)) {
      return { ok: false, state, error: "Alias round timed out" };
    }

    const team = state.teams[state.currentTeamIndex];
    if (!team) {
      return { ok: false, state, error: "Alias team not found" };
    }

    if (!team.playerIds.includes(playerId)) {
      return { ok: false, state, error: "Only the active team can score" };
    }

    if (state.activeWord) {
      state.discard.push(state.activeWord);
    }
    team.score += 1;

    if (team.score >= state.pointsToWin) {
      state.status = "ENDED";
      state.winnerTeamId = team.id;
      state.reason = "points";
      state.activeWord = null;
    } else {
      const nextWord = drawNextWord(state);
      if (!nextWord) {
        endRound(state);
      }
    }
  } else if (payload.action === "skip") {
    if (!ensureRoundActive(state, nowMs)) {
      return { ok: false, state, error: "Alias round timed out" };
    }

    if (state.activeWord) {
      state.discard.push(state.activeWord);
    }

    const nextWord = drawNextWord(state);
    if (!nextWord) {
      endRound(state);
    }
  } else if (payload.action === "endRound") {
    if (state.status !== "ROUND") {
      return { ok: false, state, error: "Alias round is not active" };
    }
    endRound(state);
  }

  state.updatedAt = nowIso();

  if (state.status === "ENDED" && state.winnerTeamId) {
    return {
      ok: true,
      state,
      error: "",
      over: {
        winnerId: null,
        reason: `alias:team:${state.winnerTeamId}`
      }
    };
  }

  return { ok: true, state, error: "" };
}
