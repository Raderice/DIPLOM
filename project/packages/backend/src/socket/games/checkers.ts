import type {
  CheckersCell,
  CheckersMovePayload,
  CheckersPiece,
  CheckersState,
  GameOverPayload,
  PlayerInRoom
} from "@board-games/shared";

interface EngineResult<TState> {
  ok: boolean;
  state: TState;
  error: string;
  over?: Pick<GameOverPayload, "winnerId" | "reason">;
}

type Coord = [number, number];

const BOARD_SIZE = 8;

function nowIso(): string {
  return new Date().toISOString();
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function cloneBoard(board: CheckersCell[][]): CheckersCell[][] {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function emptyBoard(): CheckersCell[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));
}

function createStartingBoard(whiteId: string, blackId: string): CheckersCell[][] {
  const board = emptyBoard();

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if ((row + col) % 2 === 0) continue;
      if (row < 3) {
        board[row][col] = {
          id: `b-${row}-${col}`,
          ownerId: blackId,
          color: "black",
          isKing: false
        };
      } else if (row > 4) {
        board[row][col] = {
          id: `w-${row}-${col}`,
          ownerId: whiteId,
          color: "white",
          isKing: false
        };
      }
    }
  }

  return board;
}

function kingDirections(): Coord[] {
  return [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1]
  ];
}

function manStepDirections(color: "white" | "black"): Coord[] {
  return color === "white" ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
}

function manCaptureDirections(): Coord[] {
  return kingDirections();
}

function getPieceCaptures(board: CheckersCell[][], row: number, col: number): Coord[] {
  const piece = board[row][col];
  if (!piece) return [];

  const captures: Coord[] = [];

  if (!piece.isKing) {
    for (const [dr, dc] of manCaptureDirections()) {
      const midRow = row + dr;
      const midCol = col + dc;
      const endRow = row + dr * 2;
      const endCol = col + dc * 2;
      if (!inBounds(midRow, midCol) || !inBounds(endRow, endCol)) continue;
      const middle = board[midRow][midCol];
      const landing = board[endRow][endCol];
      if (middle && middle.color !== piece.color && !landing) {
        captures.push([endRow, endCol]);
      }
    }
    return captures;
  }

  for (const [dr, dc] of kingDirections()) {
    let r = row + dr;
    let c = col + dc;
    let enemySeen = false;
    while (inBounds(r, c)) {
      const cell = board[r][c];
      if (!cell) {
        if (enemySeen) {
          captures.push([r, c]);
        }
      } else if (cell.color === piece.color) {
        break;
      } else {
        if (enemySeen) break;
        enemySeen = true;
      }
      r += dr;
      c += dc;
    }
  }

  return captures;
}

function getPieceNormalMoves(board: CheckersCell[][], row: number, col: number): Coord[] {
  const piece = board[row][col];
  if (!piece) return [];

  const moves: Coord[] = [];
  if (!piece.isKing) {
    for (const [dr, dc] of manStepDirections(piece.color)) {
      const nr = row + dr;
      const nc = col + dc;
      if (inBounds(nr, nc) && !board[nr][nc]) {
        moves.push([nr, nc]);
      }
    }
    return moves;
  }

  for (const [dr, dc] of kingDirections()) {
    let nr = row + dr;
    let nc = col + dc;
    while (inBounds(nr, nc) && !board[nr][nc]) {
      moves.push([nr, nc]);
      nr += dr;
      nc += dc;
    }
  }

  return moves;
}

function hasAnyCapture(board: CheckersCell[][], ownerId: string): boolean {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.ownerId !== ownerId) continue;
      if (getPieceCaptures(board, row, col).length > 0) return true;
    }
  }
  return false;
}

function hasAnyLegalMove(board: CheckersCell[][], ownerId: string): boolean {
  const mandatory = hasAnyCapture(board, ownerId);
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.ownerId !== ownerId) continue;

      const captures = getPieceCaptures(board, row, col);
      if (captures.length > 0) return true;
      if (!mandatory && getPieceNormalMoves(board, row, col).length > 0) return true;
    }
  }
  return false;
}

function removeCapturedPieceForMove(board: CheckersCell[][], from: Coord, to: Coord): boolean {
  const [fromRow, fromCol] = from;
  const [toRow, toCol] = to;
  // Piece has already been moved to [toRow][toCol] before this is called
  const movingPiece = board[toRow][toCol];
  if (!movingPiece) return false;

  if (!movingPiece.isKing) {
    if (Math.abs(fromRow - toRow) === 2 && Math.abs(fromCol - toCol) === 2) {
      const midRow = (fromRow + toRow) / 2;
      const midCol = (fromCol + toCol) / 2;
      if (board[midRow][midCol]) {
        board[midRow][midCol] = null;
        return true;
      }
    }
    return false;
  }

  const dr = Math.sign(toRow - fromRow);
  const dc = Math.sign(toCol - fromCol);
  let r = fromRow + dr;
  let c = fromCol + dc;
  let captured: Coord | null = null;

  while (r !== toRow && c !== toCol) {
    const cell = board[r][c];
    if (cell) {
      if (cell.color === movingPiece.color) return false;
      if (captured !== null) return false;
      captured = [r, c];
    }
    r += dr;
    c += dc;
  }

  if (captured) {
    board[captured[0]][captured[1]] = null;
    return true;
  }

  return false;
}

function countPieces(board: CheckersCell[][], ownerId: string): number {
  let count = 0;
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const piece = board[r][c];
      if (piece && piece.ownerId === ownerId) count += 1;
    }
  }
  return count;
}

export function createInitialCheckersState(players: PlayerInRoom[]): CheckersState {
  if (players.length < 2) {
    throw new Error("Checkers requires at least 2 players");
  }

  const white = players[0];
  const black = players[1];

  return {
    gameType: "checkers",
    board: createStartingBoard(white.userId, black.userId),
    turnPlayerId: white.userId,
    colorByPlayerId: {
      [white.userId]: "white",
      [black.userId]: "black"
    },
    mandatoryCapture: false,
    moveCount: 0,
    winnerId: null,
    reason: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

export function applyCheckersMove(
  state: CheckersState,
  payload: CheckersMovePayload,
  playerId: string
): EngineResult<CheckersState> {
  if (state.turnPlayerId !== playerId) {
    return { ok: false, state, error: "It is not your turn" };
  }

  const [fromRow, fromCol] = payload.from;
  const [toRow, toCol] = payload.to;

  if (!inBounds(fromRow, fromCol) || !inBounds(toRow, toCol)) {
    return { ok: false, state, error: "Move is out of board bounds" };
  }

  const board = cloneBoard(state.board);
  const piece = board[fromRow][fromCol];
  if (!piece) {
    return { ok: false, state, error: "No piece on source square" };
  }

  if (piece.ownerId !== playerId) {
    return { ok: false, state, error: "Cannot move opponent piece" };
  }

  if (board[toRow][toCol]) {
    return { ok: false, state, error: "Target square is occupied" };
  }

  const mandatory = hasAnyCapture(board, playerId);
  const captures = getPieceCaptures(board, fromRow, fromCol);
  const normals = getPieceNormalMoves(board, fromRow, fromCol);

  const targetInCaptures = captures.some(([r, c]) => r === toRow && c === toCol);
  const targetInNormals = normals.some(([r, c]) => r === toRow && c === toCol);

  if (mandatory && !targetInCaptures) {
    return { ok: false, state, error: "Capture is mandatory" };
  }

  if (!targetInCaptures && !targetInNormals) {
    return { ok: false, state, error: "Illegal checkers move" };
  }

  const nextBoard = cloneBoard(board);
  const movingPiece: CheckersPiece = { ...nextBoard[fromRow][fromCol]! };
  nextBoard[fromRow][fromCol] = null;
  nextBoard[toRow][toCol] = movingPiece;

  const didCapture = removeCapturedPieceForMove(nextBoard, [fromRow, fromCol], [toRow, toCol]);
  if (mandatory && !didCapture) {
    return { ok: false, state, error: "Capture is mandatory" };
  }

  if (!movingPiece.isKing) {
    if (movingPiece.color === "white" && toRow === 0) {
      movingPiece.isKing = true;
    }
    if (movingPiece.color === "black" && toRow === BOARD_SIZE - 1) {
      movingPiece.isKing = true;
    }
  }

  const opponentId = Object.keys(state.colorByPlayerId).find((id) => id !== playerId) ?? "";
  if (!opponentId) {
    return { ok: false, state, error: "Opponent not found" };
  }

  const opponentPieces = countPieces(nextBoard, opponentId);
  let winnerId: string | null = null;
  let reason: string | null = null;

  if (opponentPieces === 0) {
    winnerId = playerId;
    reason = "all-opponent-pieces-captured";
  } else if (!hasAnyLegalMove(nextBoard, opponentId)) {
    winnerId = playerId;
    reason = "opponent-has-no-legal-move";
  }

  const nextState: CheckersState = {
    ...state,
    board: nextBoard,
    turnPlayerId: winnerId ? state.turnPlayerId : opponentId,
    mandatoryCapture: !winnerId && hasAnyCapture(nextBoard, opponentId),
    moveCount: state.moveCount + 1,
    winnerId,
    reason,
    updatedAt: nowIso()
  };

  if (winnerId || reason) {
    return {
      ok: true,
      state: nextState,
      error: "",
      over: {
        winnerId,
        reason: reason ?? "game-over"
      }
    };
  }

  return {
    ok: true,
    state: nextState,
    error: ""
  };
}
