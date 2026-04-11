import { useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { ChessMovePayload, ChessState } from "@board-games/shared";
import { emitGameMove } from "../socket/client";
import { useGameStore } from "../store/gameStore";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { translateServerMessage } from "../lib/i18n";

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60)
    .toString()
    .padStart(2, "0");
  const sec = (totalSec % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

function getEffectiveClocks(chess: ChessState, status: string, nowMs: number): Record<string, number> {
  const clocks: Record<string, number> = { ...chess.clocksMs };
  if (status !== "PLAYING" || chess.reason) {
    return clocks;
  }

  const activePlayerId = Object.entries(chess.colorByPlayerId).find(([, color]) => color === chess.turn)?.[0];
  if (!activePlayerId) {
    return clocks;
  }

  const elapsedMs = Math.max(0, nowMs - chess.lastMoveAtMs);
  const currentValue = clocks[activePlayerId] ?? 0;
  clocks[activePlayerId] = Math.max(0, currentValue - elapsedMs);
  return clocks;
}

function toFriendlyMoveError(message: string): string {
  if (/invalid move|illegal chess move/i.test(message)) {
    return "Недопустимый ход. Выберите одну из подсвеченных клеток.";
  }
  return translateServerMessage(message);
}

function toSquare(value: string): Square | null {
  return /^[a-h][1-8]$/.test(value) ? (value as Square) : null;
}

export function ChessGame(): React.JSX.Element {
  const room = useGameStore((s) => s.room);
  const gameState = useGameStore((s) => s.gameState);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalTargets, setLegalTargets] = useState<Square[]>([]);
  const [moveError, setMoveError] = useState<string | null>(null);

  const chess = useMemo(() => {
    if (!gameState || gameState.gameType !== "chess") return null;
    return gameState as ChessState;
  }, [gameState]);

  useEffect(() => {
    if (!room || !chess || room.status !== "PLAYING" || chess.reason) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [room, chess]);

  useEffect(() => {
    setSelectedSquare(null);
    setLegalTargets([]);
    setMoveError(null);
  }, [chess?.fen]);

  if (!room || !chess) {
    return <div className="rounded-lg border p-4">Состояние шахматной партии недоступно.</div>;
  }

  const me = window.localStorage.getItem("user_id") ?? "";
  const myColor = chess.colorByPlayerId[me];
  const orientation = myColor === "b" ? "black" : "white";
  const chessEngine = useMemo(() => new Chess(chess.fen), [chess.fen]);

  const getTargetsForSquare = (square: Square): Square[] => {
    try {
      return (chessEngine.moves({ square, verbose: true }) as Array<{ to: Square }>).map((move) => move.to);
    } catch {
      return [];
    }
  };

  const getPromotionForMove = (from: Square, to: Square): "q" | undefined => {
    const piece = chessEngine.get(from);
    if (!piece || piece.type !== "p") {
      return undefined;
    }

    const toRank = Number(to[1]);
    if ((piece.color === "w" && toRank === 8) || (piece.color === "b" && toRank === 1)) {
      return "q";
    }

    return undefined;
  };

  const sendMove = async (from: Square, to: Square): Promise<boolean> => {
    const promotion = getPromotionForMove(from, to);
    const payload: ChessMovePayload = {
      gameType: "chess",
      roomId: room.id,
      from,
      to,
      ...(promotion ? { promotion } : {})
    };

    const response = await emitGameMove(payload);
    if (!response.ok) {
      setMoveError(toFriendlyMoveError(response.error));
      return false;
    }

    setMoveError(null);
    return true;
  };

  const onSquareClick = (square: string): void => {
    if (room.status !== "PLAYING" || chess.reason) return;
    if (!myColor) return;

    const normalizedSquare = toSquare(square);
    if (!normalizedSquare) return;

    const isMyTurn = chess.turn === myColor;
    const piece = chessEngine.get(normalizedSquare);

    if (selectedSquare && legalTargets.includes(normalizedSquare)) {
      void sendMove(selectedSquare, normalizedSquare).then((ok) => {
        if (ok) {
          setSelectedSquare(null);
          setLegalTargets([]);
        }
      });
      return;
    }

    if (selectedSquare === normalizedSquare) {
      setSelectedSquare(null);
      setLegalTargets([]);
      setMoveError(null);
      return;
    }

    if (!isMyTurn) {
      setMoveError("Подождите своего хода.");
      return;
    }

    if (piece && piece.color === myColor) {
      const targets = getTargetsForSquare(normalizedSquare);
      setSelectedSquare(normalizedSquare);
      setLegalTargets(targets);
      setMoveError(targets.length === 0 ? "У этой фигуры нет допустимых ходов." : null);
      return;
    }

    if (selectedSquare) {
      setMoveError("Недопустимая клетка. Выберите одну из подсвеченных.");
    }
  };

  const onPieceDrop = (sourceSquare: string, targetSquare: string): boolean => {
    if (room.status !== "PLAYING" || chess.reason) return false;
    if (!myColor) return false;
    if (chess.turn !== myColor) {
      setMoveError("Подождите своего хода.");
      return false;
    }

    const from = toSquare(sourceSquare);
    const to = toSquare(targetSquare);
    if (!from || !to) return false;

    const piece = chessEngine.get(from);
    if (!piece || piece.color !== myColor) {
      setMoveError("Можно двигать только свои фигуры.");
      return false;
    }

    const legal = getTargetsForSquare(from);
    if (!legal.includes(to)) {
      setMoveError("Недопустимая клетка. Выберите одну из подсвеченных.");
      return false;
    }

    setSelectedSquare(from);
    setLegalTargets(legal);

    void sendMove(from, to).then((ok) => {
      if (ok) {
        setSelectedSquare(null);
        setLegalTargets([]);
      }
    });

    return true;
  };

  const whitePlayerId = Object.entries(chess.colorByPlayerId).find(([, c]) => c === "w")?.[0] ?? "";
  const blackPlayerId = Object.entries(chess.colorByPlayerId).find(([, c]) => c === "b")?.[0] ?? "";
  const clocks = useMemo(() => getEffectiveClocks(chess, room.status, nowMs), [chess, room.status, nowMs]);
  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (selectedSquare) {
      styles[selectedSquare] = {
        boxShadow: "inset 0 0 0 4px rgba(245, 158, 11, 0.95)"
      };
    }

    for (const target of legalTargets) {
      styles[target] = {
        background:
          "radial-gradient(circle, rgba(34,197,94,0.45) 0%, rgba(34,197,94,0.22) 40%, rgba(34,197,94,0.10) 70%, rgba(34,197,94,0.0) 100%)"
      };
    }

    return styles;
  }, [selectedSquare, legalTargets]);

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <Card>
        <CardContent className="p-3">
          <Chessboard
            id={`chess-board-${room.id}`}
            boardOrientation={orientation}
            position={chess.fen}
            onSquareClick={onSquareClick}
            onPieceDrop={onPieceDrop}
            arePiecesDraggable={true}
            customSquareStyles={squareStyles}
            customBoardStyle={{
              borderRadius: "10px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.15)"
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Блиц 10+0</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">Ход: {chess.turn === "w" ? "Белые" : "Черные"}</p>
          <p className="text-xs text-slate-500">Ходите перетягиванием или кликом: выберите фигуру и затем клетку назначения.</p>

          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs uppercase text-slate-500">Белые</div>
            <div className="font-mono text-xl">{formatClock(clocks[whitePlayerId] ?? 0)}</div>
          </div>

          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs uppercase text-slate-500">Черные</div>
            <div className="font-mono text-xl">{formatClock(clocks[blackPlayerId] ?? 0)}</div>
          </div>

          {moveError ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{moveError}</div>
          ) : null}

          {chess.reason ? (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
              Игра завершена: {translateServerMessage(chess.reason)}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
