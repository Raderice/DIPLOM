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
  const min = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const sec = (totalSec % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

function getEffectiveClocks(chess: ChessState, status: string, nowMs: number): Record<string, number> {
  const clocks: Record<string, number> = { ...chess.clocksMs };
  if (status !== "PLAYING" || chess.reason) return clocks;
  const activePlayerId = Object.entries(chess.colorByPlayerId).find(([, color]) => color === chess.turn)?.[0];
  if (!activePlayerId) return clocks;
  const elapsedMs = Math.max(0, nowMs - chess.lastMoveAtMs);
  clocks[activePlayerId] = Math.max(0, (clocks[activePlayerId] ?? 0) - elapsedMs);
  return clocks;
}

function toFriendlyMoveError(message: string): string {
  if (/invalid move|illegal chess move/i.test(message)) return "Недопустимый ход.";
  return translateServerMessage(message);
}

function toSquare(value: string): Square | null {
  return /^[a-h][1-8]$/.test(value) ? (value as Square) : null;
}

export function ChessGame(): React.JSX.Element {
  const room      = useGameStore((s) => s.room);
  const gameState = useGameStore((s) => s.gameState);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalTargets,   setLegalTargets]   = useState<Square[]>([]);
  const [legalCaptures,  setLegalCaptures]  = useState<Square[]>([]);
  const [moveError,      setMoveError]      = useState<string | null>(null);
  const [promotionTarget, setPromotionTarget] = useState<{ from: Square; to: Square } | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [boardSize, setBoardSize] = useState(520);

  const chess = useMemo(() => {
    if (!gameState || gameState.gameType !== "chess") return null;
    return gameState as ChessState;
  }, [gameState]);

  const chessEngine = useMemo(
    () => (chess ? new Chess(chess.fen) : null),
    [chess?.fen]
  );

  useEffect(() => {
    if (!room || !chess || room.status !== "PLAYING" || chess.reason) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
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
      const w = boardRef.current?.clientWidth ?? 520;
      setBoardSize(Math.max(280, Math.min(600, w)));
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(boardRef.current);
    return () => obs.disconnect();
  }, []);

  if (!room || !chess || !chessEngine) {
    return <div className="rounded-lg border p-4">Состояние партии недоступно.</div>;
  }

  const me      = window.localStorage.getItem("user_id") ?? "";
  const myColor = chess.colorByPlayerId[me];
  const orientation: "white" | "black" = myColor === "b" ? "black" : "white";
  const isMyTurn = chess.turn === myColor;
  const gameOver = !!chess.reason || room.status !== "PLAYING";

  // ── helpers ────────────────────────────────────────────────────────────────

  const getLegalTargets = (sq: Square): { targets: Square[]; captures: Square[] } => {
    try {
      const moves = chessEngine.moves({ square: sq, verbose: true }) as Array<{ to: Square; captured?: string }>;
      const targets: Square[]  = [];
      const captures: Square[] = [];
      for (const m of moves) {
        targets.push(m.to);
        if (m.captured) captures.push(m.to);
      }
      return { targets, captures };
    } catch { return { targets: [], captures: [] }; }
  };

  const isPromotion = (from: Square, to: Square): boolean => {
    const piece = chessEngine.get(from);
    if (!piece || piece.type !== "p") return false;
    const rank = Number(to[1]);
    return (piece.color === "w" && rank === 8) || (piece.color === "b" && rank === 1);
  };

  const sendMove = async (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n"): Promise<void> => {
    const payload: ChessMovePayload = { gameType: "chess", roomId: room.id, from, to, ...(promotion ? { promotion } : {}) };
    const response = await emitGameMove(payload);
    if (!response.ok) {
      setMoveError(toFriendlyMoveError(response.error));
    } else {
      setMoveError(null);
    }
  };

  // ── click handler ───────────────────────────────────────────────────────────

  const onSquareClick = (square: string): void => {
    if (gameOver) return;
    if (!myColor || !isMyTurn) { setMoveError("Подождите своего хода."); return; }

    const sq = toSquare(square);
    if (!sq) return;

    // If a piece is selected and we clicked a legal target → move
    if (selectedSquare && legalTargets.includes(sq)) {
      if (isPromotion(selectedSquare, sq)) {
        setPromotionTarget({ from: selectedSquare, to: sq });
        return;
      }
      void sendMove(selectedSquare, sq);
      return;
    }

    // Deselect if clicking selected square
    if (selectedSquare === sq) {
      setSelectedSquare(null); setLegalTargets([]); setMoveError(null);
      return;
    }

    // Select own piece
    const piece = chessEngine.get(sq);
    if (piece && piece.color === myColor) {
      const { targets, captures } = getLegalTargets(sq);
      setSelectedSquare(sq);
      setLegalTargets(targets);
      setLegalCaptures(captures);
      setMoveError(targets.length === 0 ? "Нет допустимых ходов." : null);
      return;
    }

    if (selectedSquare) setMoveError("Недопустимая клетка.");
  };

  // ── drag handler ────────────────────────────────────────────────────────────
  // Always return false → board stays at chess.fen (server-controlled position).
  // We fire the move and let FEN from the server drive the visual update.

  const isDraggablePiece = ({ piece }: { piece: string }): boolean => {
    if (gameOver || !myColor || !isMyTurn) return false;
    // piece[0] is 'w' or 'b'
    return piece[0] === myColor;
  };

  const onPieceDragBegin = (_piece: string, sourceSquare: string): void => {
    const sq = toSquare(sourceSquare);
    if (!sq) return;
    const { targets, captures } = getLegalTargets(sq);
    setSelectedSquare(sq);
    setLegalTargets(targets);
    setLegalCaptures(captures);
    setMoveError(null);
  };

  const onPieceDrop = (sourceSquare: string, targetSquare: string): boolean => {
    const from = toSquare(sourceSquare);
    const to   = toSquare(targetSquare);
    if (!from || !to) return false;

    if (!myColor || !isMyTurn || gameOver) return false;

    const { targets } = getLegalTargets(from);
    if (!targets.includes(to)) {
      setMoveError("Недопустимый ход.");
      setSelectedSquare(null); setLegalTargets([]);
      return false;
    }

    if (isPromotion(from, to)) {
      setPromotionTarget({ from, to });
      return false;
    }

    void sendMove(from, to);
    return false; // let server FEN drive position
  };

  const onSelectPromotion = (promotion: "q" | "r" | "b" | "n") => {
    if (!promotionTarget) return;
    void sendMove(promotionTarget.from, promotionTarget.to, promotion);
    setPromotionTarget(null);
  };

  // ── derived ─────────────────────────────────────────────────────────────────

  const whiteId = Object.entries(chess.colorByPlayerId).find(([, c]) => c === "w")?.[0] ?? "";
  const blackId = Object.entries(chess.colorByPlayerId).find(([, c]) => c === "b")?.[0] ?? "";
  const clocks  = useMemo(() => getEffectiveClocks(chess, room.status, nowMs), [chess, room.status, nowMs]);

  const squareStyles = useMemo((): Record<string, React.CSSProperties> => {
    const styles: Record<string, React.CSSProperties> = {};
    if (selectedSquare) {
      styles[selectedSquare] = { boxShadow: "inset 0 0 0 4px rgba(242,201,76,0.9)" };
    }
    for (const target of legalTargets) {
      styles[target] = legalCaptures.includes(target)
        ? { boxShadow: "inset 0 0 0 3px rgba(242,201,76,0.9)" }
        : { background: "radial-gradient(circle, rgba(242,201,76,0.45) 0%, rgba(242,201,76,0.15) 50%, transparent 70%)" };
    }
    return styles;
  }, [selectedSquare, legalTargets, legalCaptures]);

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <section className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_280px]">
      <Card>
        <CardContent className="p-2 sm:p-3">
          <div ref={boardRef} className="game-canvas">
            <Chessboard
              id={`chess-board-${room.id}`}
              boardOrientation={orientation}
              position={chess.fen}
              boardWidth={boardSize}
              onSquareClick={onSquareClick}
              onPieceDragBegin={onPieceDragBegin}
              onPieceDrop={onPieceDrop}
              isDraggablePiece={isDraggablePiece}
              arePiecesDraggable={!gameOver}
              customDarkSquareStyle={{ backgroundColor: "var(--board-dark)" }}
              customLightSquareStyle={{ backgroundColor: "var(--board-light)" }}
              customSquareStyles={squareStyles}
              customBoardStyle={{
                borderRadius: "10px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)"
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Шахматы · Блиц 10+0</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* My color */}
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm">
            Вы играете: <span className="font-semibold text-foreground">{myColor === "w" ? "Белыми ♔" : myColor === "b" ? "Чёрными ♚" : "Наблюдатель"}</span>
          </div>

          {/* Turn */}
          <div className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
            isMyTurn && !gameOver
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-muted/20 text-muted-foreground"
          }`}>
            {gameOver ? "Игра завершена" : isMyTurn ? "Ваш ход" : "Ход соперника..."}
          </div>

          {/* Clocks */}
          {[
            { label: "Белые ♔", id: whiteId },
            { label: "Чёрные ♚", id: blackId }
          ].map(({ label, id }) => {
            const ms = clocks[id] ?? 0;
            const low = ms < 30_000;
            return (
              <div key={id} className={`rounded-xl border px-4 py-3 ${low ? "border-danger/40 bg-danger/10" : "border-border bg-muted/30"}`}>
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className={`font-mono text-2xl font-bold tabular-nums ${low ? "text-danger" : "text-foreground"}`}>
                  {formatClock(ms)}
                </div>
              </div>
            );
          })}

          {/* Move counter */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-2.5">
            <span className="text-xs text-muted-foreground">Ходов</span>
            <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
              {Math.floor(chess.moveHistory.length / 2) + (chess.moveHistory.length % 2)}
            </span>
          </div>

          {moveError ? (
            <div className="notice-error">{moveError}</div>
          ) : null}

          {chess.reason ? (
            <div className="notice-warn font-semibold">
              Игра завершена: {translateServerMessage(chess.reason)}
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Перетащите фигуру или кликните: сначала фигура, затем клетка назначения.
          </p>
        </CardContent>
      </Card>

      {/* Promotion dialog */}
      {promotionTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border border-border bg-card p-5 shadow-panel">
            <h3 className="font-display text-lg font-semibold">Превращение пешки</h3>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">Выберите фигуру:</p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => onSelectPromotion("q")}>♛ Ферзь</Button>
              <Button variant="secondary" onClick={() => onSelectPromotion("r")}>♜ Ладья</Button>
              <Button variant="secondary" onClick={() => onSelectPromotion("b")}>♝ Слон</Button>
              <Button variant="secondary" onClick={() => onSelectPromotion("n")}>♞ Конь</Button>
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
