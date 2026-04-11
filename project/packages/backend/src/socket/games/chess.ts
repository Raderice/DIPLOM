import { Chess } from "chess.js";
import type { ChessMovePayload, ChessState, GameOverPayload, PlayerInRoom } from "@board-games/shared";

interface EngineResult<TState> {
  ok: boolean;
  state: TState;
  error: string;
  over?: Pick<GameOverPayload, "winnerId" | "reason">;
}

const INITIAL_CLOCK_MS = 10 * 60 * 1000;

function nowIso(): string {
  return new Date().toISOString();
}

function opponentColor(color: "w" | "b"): "w" | "b" {
  return color === "w" ? "b" : "w";
}

function findPlayerByColor(state: ChessState, color: "w" | "b"): string | null {
  for (const [playerId, playerColor] of Object.entries(state.colorByPlayerId)) {
    if (playerColor === color) return playerId;
  }
  return null;
}

export function createInitialChessState(players: PlayerInRoom[]): ChessState {
  if (players.length < 2) {
    throw new Error("Chess requires at least 2 players");
  }

  const white = players[0];
  const black = players[1];
  const clocksMs: Record<string, number> = {
    [white.userId]: INITIAL_CLOCK_MS,
    [black.userId]: INITIAL_CLOCK_MS
  };

  return {
    gameType: "chess",
    fen: new Chess().fen(),
    turn: "w",
    colorByPlayerId: {
      [white.userId]: "w",
      [black.userId]: "b"
    },
    clocksMs,
    lastMoveAtMs: Date.now(),
    moveHistory: [],
    winnerId: null,
    reason: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

export function applyChessMove(
  state: ChessState,
  payload: ChessMovePayload,
  playerId: string,
  nowMs: number
): EngineResult<ChessState> {
  const moverColor = state.colorByPlayerId[playerId];
  if (!moverColor) {
    return {
      ok: false,
      state,
      error: "Player is not assigned to chess colors"
    };
  }

  if (moverColor !== state.turn) {
    return {
      ok: false,
      state,
      error: "It is not your turn"
    };
  }

  const elapsedMs = Math.max(0, nowMs - state.lastMoveAtMs);
  const remaining = (state.clocksMs[playerId] ?? INITIAL_CLOCK_MS) - elapsedMs;
  if (remaining <= 0) {
    const winnerId = findPlayerByColor(state, opponentColor(moverColor));
    const timeoutState: ChessState = {
      ...state,
      clocksMs: {
        ...state.clocksMs,
        [playerId]: 0
      },
      winnerId,
      reason: "timeout",
      updatedAt: nowIso()
    };

    return {
      ok: true,
      state: timeoutState,
      error: "",
      over: {
        winnerId,
        reason: "timeout"
      }
    };
  }

  const chess = new Chess(state.fen);
  const moveInput = payload.promotion
    ? {
        from: payload.from,
        to: payload.to,
        promotion: payload.promotion
      }
    : {
        from: payload.from,
        to: payload.to
      };
  let move: ReturnType<Chess["move"]> | null = null;
  try {
    move = chess.move(moveInput);
  } catch {
    move = null;
  }

  if (!move) {
    return {
      ok: false,
      state,
      error: "Illegal chess move"
    };
  }

  const updatedClocks = {
    ...state.clocksMs,
    [playerId]: remaining
  };

  let winnerId: string | null = null;
  let reason: string | null = null;

  if (chess.isCheckmate()) {
    winnerId = playerId;
    reason = "checkmate";
  } else if (chess.isDraw()) {
    winnerId = null;
    reason = "draw";
  } else if (chess.isStalemate()) {
    winnerId = null;
    reason = "stalemate";
  } else if (chess.isThreefoldRepetition()) {
    winnerId = null;
    reason = "threefold-repetition";
  } else if (chess.isInsufficientMaterial()) {
    winnerId = null;
    reason = "insufficient-material";
  }

  const nextState: ChessState = {
    ...state,
    fen: chess.fen(),
    turn: chess.turn(),
    clocksMs: updatedClocks,
    lastMoveAtMs: nowMs,
    moveHistory: [...state.moveHistory, move.san],
    winnerId,
    reason,
    updatedAt: nowIso()
  };

  if (reason !== null) {
    return {
      ok: true,
      state: nextState,
      error: "",
      over: {
        winnerId,
        reason
      }
    };
  }

  return {
    ok: true,
    state: nextState,
    error: ""
  };
}
