import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { ChessMovePayload, ChessState } from "@board-games/shared";
import { emitGameMove } from "../socket/client";
import { useGameStore } from "../store/gameStore";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
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
  const [legalCaptures, setLegalCaptures] = useState<Square[]>([]);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [promotionTarget, setPromotionTarget] = useState<{ from: Square; to: Square } | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [boardSize, setBoardSize] = useState(520);

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
    setLegalCaptures([]);
    setMoveError(null);
    setPromotionTarget(null);
  }, [chess?.fen]);

  useEffect(() => {
    if (!boardRef.current) return;

    const update = () => {
      const width = boardRef.current?.clientWidth ?? 520;
      setBoardSize(Math.max(280, Math.min(560, width)));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(boardRef.current);

    return () => observer.disconnect();
  }, []);

  if (!room || !chess) {
    return <div className="rounded-lg border p-4">Состояние шахматной партии недоступно.</div>;
  }

  const me = window.localStorage.getItem("user_id") ?? "";
  const myColor = chess.colorByPlayerId[me];
  const orientation = myColor === "b" ? "black" : "white";
  const chessEngine = useMemo(() => new Chess(chess.fen), [chess.fen]);

  const getTargetsForSquare = (square: Square): { targets: Square[]; captures: Square[] } => {
    try {
      const moves = chessEngine.moves({ square, verbose: true }) as Array<{ to: Square; captured?: string }>;
      const targets: Square[] = [];
      const captures: Square[] = [];

      for (const move of moves) {
        targets.push(move.to);
        if (move.captured) {
          captures.push(move.to);
        }
      }

      return { targets, captures };
    } catch {
      return { targets: [], captures: [] };
    }
  };

  const isPromotionMove = (from: Square, to: Square): boolean => {
    const piece = chessEngine.get(from);
    if (!piece || piece.type !== "p") {
      return false;
    }

    const toRank = Number(to[1]);
    return (piece.color === "w" && toRank === 8) || (piece.color === "b" && toRank === 1);
  };

  const sendMove = async (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n"): Promise<boolean> => {
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
    if (chess.turn !== myColor) {
      setMoveError("Подождите своего хода.");
      return;
    }

    const normalizedSquare = toSquare(square);
    if (!normalizedSquare) return;

    const isMyTurn = chess.turn === myColor;
    const piece = chessEngine.get(normalizedSquare);

    if (selectedSquare && legalTargets.includes(normalizedSquare)) {
      if (isPromotionMove(selectedSquare, normalizedSquare)) {
        setPromotionTarget({ from: selectedSquare, to: normalizedSquare });
        return;
      }

      void sendMove(selectedSquare, normalizedSquare).then((ok) => {
        if (ok) {
          setSelectedSquare(null);
          setLegalTargets([]);
          setLegalCaptures([]);
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
      const { targets, captures } = getTargetsForSquare(normalizedSquare);
      setSelectedSquare(normalizedSquare);
      setLegalTargets(targets);
      setLegalCaptures(captures);
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

    const { targets, captures } = getTargetsForSquare(from);
    if (!targets.includes(to)) {
      setMoveError("Недопустимая клетка. Выберите одну из подсвеченных.");
      return false;
    }

    setSelectedSquare(from);
    setLegalTargets(targets);
    setLegalCaptures(captures);

    if (isPromotionMove(from, to)) {
      setPromotionTarget({ from, to });
      return false;
    }

    void sendMove(from, to).then((ok) => {
      if (ok) {
        setSelectedSquare(null);
        setLegalTargets([]);
        setLegalCaptures([]);
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
        boxShadow: "inset 0 0 0 4px rgba(242, 201, 76, 0.95)"
      };
    }

    for (const target of legalTargets) {
      const isCapture = legalCaptures.includes(target);
      styles[target] = isCapture
        ? {
            boxShadow: "inset 0 0 0 3px rgba(242, 201, 76, 0.95)"
          }
        : {
            background:
              "radial-gradient(circle, rgba(242,201,76,0.5) 0%, rgba(242,201,76,0.2) 45%, rgba(242,201,76,0.0) 70%)"
          };
    }

    return styles;
  }, [selectedSquare, legalTargets, legalCaptures]);

  const onSelectPromotion = (promotion: "q" | "r" | "b" | "n") => {
    if (!promotionTarget) return;
    const { from, to } = promotionTarget;
    void sendMove(from, to, promotion).then((ok) => {
      if (ok) {
        setSelectedSquare(null);
        setLegalTargets([]);
        setLegalCaptures([]);
      }
      setPromotionTarget(null);
    });
  };

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <Card>
        <CardContent className="p-3">
          <div ref={boardRef} className="game-canvas">
            <Chessboard
              id={`chess-board-${room.id}`}
              boardOrientation={orientation}
              position={chess.fen}
              onSquareClick={onSquareClick}
              onPieceDrop={onPieceDrop}
              arePiecesDraggable={true}
              boardWidth={boardSize}
              customDarkSquareStyle={{ backgroundColor: "var(--board-dark)" }}
              customLightSquareStyle={{ backgroundColor: "var(--board-light)" }}
              customSquareStyles={squareStyles}
              customBoardStyle={{
                borderRadius: "12px",
                boxShadow: "0 12px 30px rgba(0, 0, 0, 0.45)",
                touchAction: "manipulation"
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Блиц 10+0</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Ход: {chess.turn === "w" ? "Белые" : "Черные"}</p>
          <p className="text-xs text-muted-foreground">Ходите перетягиванием или кликом: выберите фигуру и затем клетку назначения.</p>

          <div className="rounded-md border border-border bg-[#23262a] p-3">
            <div className="text-xs uppercase text-muted-foreground">Белые</div>
            <div className="font-mono text-xl text-foreground">{formatClock(clocks[whitePlayerId] ?? 0)}</div>
          </div>

          <div className="rounded-md border border-border bg-[#23262a] p-3">
            <div className="text-xs uppercase text-muted-foreground">Черные</div>
            <div className="font-mono text-xl text-foreground">{formatClock(clocks[blackPlayerId] ?? 0)}</div>
          </div>

          {moveError ? (
            <div className="rounded-md border border-[#d35d5d]/40 bg-[#2c2020] p-3 text-sm text-[#d35d5d]">
              {moveError}
            </div>
          ) : null}

          {chess.reason ? (
            <div className="rounded-md border border-[#f2c94c]/40 bg-[#2f2a1b] p-3 text-sm text-[#f2c94c]">
              Игра завершена: {translateServerMessage(chess.reason)}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {promotionTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5">
            <h3 className="font-display text-lg font-semibold text-foreground">Выберите фигуру для превращения</h3>
            <p className="mt-1 text-sm text-muted-foreground">Пешка достигла последней линии.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button onClick={() => onSelectPromotion("q")}>Ферзь</Button>
              <Button variant="secondary" onClick={() => onSelectPromotion("r")}>Ладья</Button>
              <Button variant="secondary" onClick={() => onSelectPromotion("b")}>Слон</Button>
              <Button variant="secondary" onClick={() => onSelectPromotion("n")}>Конь</Button>
            </div>
            <Button variant="outline" className="mt-3 w-full" onClick={() => setPromotionTarget(null)}>
              Отмена
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
