import { useEffect, useMemo, useRef, useState } from "react";
import { Layer, Rect, Stage, Circle, Group } from "react-konva";
import type { CheckersMovePayload, CheckersState } from "@board-games/shared";
import { emitGameMove } from "../socket/client";
import { useGameStore } from "../store/gameStore";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { translateServerMessage } from "../lib/i18n";

const BASE_BOARD = 520;
const LIGHT_SQUARE = "#f0d9b5";
const DARK_SQUARE = "#b58863";

type Coord = [number, number];

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
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

function getCaptures(state: CheckersState, row: number, col: number): Coord[] {
  const piece = state.board[row]?.[col] ?? null;
  if (!piece) return [];

  const captures: Coord[] = [];
  if (!piece.isKing) {
    for (const [dr, dc] of kingDirections()) {
      const midRow = row + dr;
      const midCol = col + dc;
      const endRow = row + dr * 2;
      const endCol = col + dc * 2;

      if (!inBounds(midRow, midCol) || !inBounds(endRow, endCol)) continue;
      const middle = state.board[midRow]?.[midCol] ?? null;
      const landing = state.board[endRow]?.[endCol] ?? null;
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
      const cell = state.board[r]?.[c] ?? null;
      if (!cell) {
        if (enemySeen) captures.push([r, c]);
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

function getNormalMoves(state: CheckersState, row: number, col: number): Coord[] {
  const piece = state.board[row]?.[col] ?? null;
  if (!piece) return [];

  const moves: Coord[] = [];
  if (!piece.isKing) {
    for (const [dr, dc] of manStepDirections(piece.color)) {
      const nr = row + dr;
      const nc = col + dc;
      if (inBounds(nr, nc) && !state.board[nr]?.[nc]) {
        moves.push([nr, nc]);
      }
    }
    return moves;
  }

  for (const [dr, dc] of kingDirections()) {
    let nr = row + dr;
    let nc = col + dc;
    while (inBounds(nr, nc) && !state.board[nr]?.[nc]) {
      moves.push([nr, nc]);
      nr += dr;
      nc += dc;
    }
  }

  return moves;
}

function toFriendlyMoveError(message: string): string {
  if (/illegal checkers move/i.test(message)) {
    return "Недопустимый ход. Выберите одну из подсвеченных клеток.";
  }
  if (/capture is mandatory/i.test(message)) {
    return "Взятие обязательно. Выберите фигуру с взятием и одну из подсвеченных клеток.";
  }
  return translateServerMessage(message);
}

export function CheckersGame(): React.JSX.Element {
  const room = useGameStore((s) => s.room);
  const gameState = useGameStore((s) => s.gameState);
  const [selected, setSelected] = useState<Coord | null>(null);
  const [legalTargets, setLegalTargets] = useState<Coord[]>([]);
  const [moveError, setMoveError] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [boardSize, setBoardSize] = useState(BASE_BOARD);

  const state = useMemo(() => {
    if (!gameState || gameState.gameType !== "checkers") return null;
    return gameState as CheckersState;
  }, [gameState]);

  useEffect(() => {
    if (!boardRef.current) return;
    const update = () => {
      const width = boardRef.current?.clientWidth ?? BASE_BOARD;
      setBoardSize(Math.max(260, Math.min(BASE_BOARD, width)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(boardRef.current);
    return () => observer.disconnect();
  }, []);

  if (!room || !state) {
    return <div className="rounded-lg border p-4">Состояние партии в шашки недоступно.</div>;
  }

  const myUserId = window.localStorage.getItem("user_id") ?? "";
  const myColor = state.colorByPlayerId[myUserId];
  const isFlipped = myColor === "black";
  const cellSize = boardSize / 8;

  const toViewCoord = (row: number, col: number): Coord => {
    if (!isFlipped) return [row, col];
    return [7 - row, 7 - col];
  };

  const toBoardCoord = (viewRow: number, viewCol: number): Coord => {
    if (!isFlipped) return [viewRow, viewCol];
    return [7 - viewRow, 7 - viewCol];
  };

  const moveFromPiece = async (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    if (room.status !== "PLAYING" || state.reason) return;
    if (state.turnPlayerId !== myUserId) {
      setMoveError("Подождите своего хода.");
      return;
    }

    const piece = state.board[fromRow]?.[fromCol] ?? null;
    if (!piece || piece.ownerId !== myUserId) {
      return;
    }

    const captures = getCaptures(state, fromRow, fromCol);
    const normals = getNormalMoves(state, fromRow, fromCol);
    const targets = state.mandatoryCapture ? captures : captures.length > 0 ? captures : normals;
    const isLegal = targets.some(([r, c]) => r === toRow && c === toCol);

    setSelected([fromRow, fromCol]);
    setLegalTargets(targets);

    if (!isLegal) {
      setMoveError("Недопустимая клетка. Выберите одну из подсвеченных.");
      return;
    }

    const payload: CheckersMovePayload = {
      gameType: "checkers",
      roomId: room.id,
      from: [fromRow, fromCol],
      to: [toRow, toCol]
    };

    const result = await emitGameMove(payload);
    if (!result.ok) {
      setMoveError(toFriendlyMoveError(result.error));
    } else {
      setMoveError(null);
    }

    setSelected(null);
    setLegalTargets([]);
  };

  const selectPiece = (row: number, col: number) => {
    const piece = state.board[row]?.[col] ?? null;
    if (!piece || piece.ownerId !== myUserId) {
      setSelected(null);
      setLegalTargets([]);
      return;
    }

    const captures = getCaptures(state, row, col);
    const normals = getNormalMoves(state, row, col);
    const targets = state.mandatoryCapture ? captures : captures.length > 0 ? captures : normals;

    setSelected([row, col]);
    setLegalTargets(targets);
    setMoveError(targets.length === 0 ? "У этой фигуры нет допустимых ходов." : null);
  };

  const onCellClick = async (row: number, col: number) => {
    if (room.status !== "PLAYING" || state.reason) return;
    if (state.turnPlayerId !== myUserId) {
      setMoveError("Подождите своего хода.");
      return;
    }

    const rowCells = state.board[row];
    const piece = rowCells?.[col] ?? null;

    if (!selected) {
      if (piece && piece.ownerId === myUserId) {
        selectPiece(row, col);
      }
      return;
    }

    const [fromRow, fromCol] = selected;
    if (fromRow === row && fromCol === col) {
      setSelected(null);
      setLegalTargets([]);
      setMoveError(null);
      return;
    }

    if (piece && piece.ownerId === myUserId) {
      selectPiece(row, col);
      return;
    }

    const isLegal = legalTargets.some(([r, c]) => r === row && c === col);
    if (!isLegal) {
      setMoveError("Недопустимая клетка. Выберите одну из подсвеченных.");
      return;
    }

    await moveFromPiece(fromRow, fromCol, row, col);
  };

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <Card>
        <CardContent className="p-3">
          <div ref={boardRef} className="game-canvas touch-none">
            <Stage width={boardSize} height={boardSize}>
              <Layer>
              {Array.from({ length: 8 }).map((_, vr) =>
                Array.from({ length: 8 }).map((__, vc) => {
                  const [r, c] = toBoardCoord(vr, vc);
                  const dark = (r + c) % 2 === 1;
                  const isSelected = selected?.[0] === r && selected[1] === c;
                  const isLegal = legalTargets.some(([lr, lc]) => lr === r && lc === c);
                  return (
                    <Rect
                      key={`sq-${r}-${c}`}
                      x={vc * cellSize}
                      y={vr * cellSize}
                      width={cellSize}
                      height={cellSize}
                      fill={
                        isSelected
                          ? "#f2c94c"
                          : isLegal
                            ? "#f2c94c"
                            : dark
                              ? DARK_SQUARE
                              : LIGHT_SQUARE
                      }
                      opacity={isLegal || isSelected ? 0.88 : 1}
                      onClick={() => void onCellClick(r, c)}
                    />
                  );
                })
              )}

              {state.board.map((row, r) =>
                row.map((piece, c) => {
                  if (!piece) return null;
                  const [vr, vc] = toViewCoord(r, c);
                  const cx = vc * cellSize + cellSize / 2;
                  const cy = vr * cellSize + cellSize / 2;
                  const fill = piece.color === "white" ? "#f7f1e1" : "#1e2023";
                  const stroke = piece.color === "white" ? "#4b4f56" : "#e3d7b8";
                  

                  return (
                    <Group
                      key={`piece-${piece.id}`}
                      x={cx}
                      y={cy}
                      onClick={() => void onCellClick(r, c)}
                    >
                      <Circle x={0} y={0} radius={cellSize * 0.36} fill={fill} stroke={stroke} strokeWidth={3} />
                      {piece.isKing ? (
                        <Circle x={0} y={0} radius={cellSize * 0.2} fill="#f2c94c" stroke="#7a5f1b" strokeWidth={2} />
                      ) : null}
                    </Group>
                  );
                })
              )}
              </Layer>
            </Stage>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Русские шашки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Вы: {myColor === "white" ? "белые" : myColor === "black" ? "черные" : "наблюдатель"}</p>
          <p>Ход: {state.turnPlayerId === myUserId ? "ваш" : "соперника"}</p>
          <p className="text-xs text-muted-foreground">Ходите кликом: выберите фигуру и затем клетку назначения.</p>
          <p>Обязательное взятие: {state.mandatoryCapture ? "да" : "нет"}</p>
          {moveError ? (
            <div className="rounded-md border border-[#d35d5d]/40 bg-[#2c2020] p-3 text-[#d35d5d]">{moveError}</div>
          ) : null}
          {state.reason ? (
            <div className="rounded-md border border-[#f2c94c]/40 bg-[#2f2a1b] p-3 text-[#f2c94c]">
              Игра завершена: {translateServerMessage(state.reason)}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
