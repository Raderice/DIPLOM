import { useMemo, useState } from "react";
import type { DurakMovePayload, DurakPlayerViewState } from "@board-games/shared";
import { emitGameMove } from "../socket/client";
import { useGameStore } from "../store/gameStore";
import { translateServerMessage } from "../lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DCard  { id: string; rank: string; suit: string }
interface DPair  { id: string; attack: DCard; defense: DCard | null }
interface DPlayer { userId: string; username: string; isSelf: boolean; handCount: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SUIT_SYM: Record<string, string> = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };
const isRed = (s: string) => s === "hearts" || s === "diamonds";
const sym   = (s: string) => SUIT_SYM[s] ?? "?";

// ─── Single playing card ──────────────────────────────────────────────────────
function Card({
  card, selected = false, targeted = false, dim = false,
  onClick, size = "md"
}: {
  card: DCard; selected?: boolean; targeted?: boolean; dim?: boolean;
  onClick?: () => void; size?: "sm" | "md" | "lg"
}) {
  const red = isRed(card.suit);
  const s   = sym(card.suit);
  const szCls = size === "sm" ? "h-[68px] w-[48px] text-[11px]"
              : size === "lg" ? "h-[112px] w-[76px] text-[13px]"
              :                 "h-[88px] w-[60px] text-[12px]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative flex flex-col justify-between rounded-lg border-2 bg-white select-none",
        "font-bold leading-none shadow-md transition-all duration-150",
        "focus-visible:outline-none",
        szCls,
        red ? "text-red-600" : "text-gray-900",
        selected  ? "border-[#f2c94c] shadow-[0_0_0_3px_rgba(242,201,76,0.55)] -translate-y-4 z-20"
        : targeted ? "border-blue-400 shadow-[0_0_0_2px_rgba(96,165,250,0.55)] scale-105 z-10"
        :            "border-gray-200 hover:border-gray-400 hover:shadow-lg hover:-translate-y-1",
        onClick   ? "cursor-pointer" : "cursor-default",
        dim       ? "opacity-40" : ""
      ].join(" ")}
    >
      <span className="px-1 pt-1">{card.rank}<br />{s}</span>
      <span className="self-center text-lg">{s}</span>
      <span className="self-end rotate-180 px-1 pb-1">{card.rank}<br />{s}</span>
    </button>
  );
}

// ─── Face-down card stack ─────────────────────────────────────────────────────
function FaceDownStack({ count, size = "sm" }: { count: number; size?: "sm" | "md" }) {
  const shown = Math.min(count, 6);
  const szCls = size === "sm" ? "h-[52px] w-[36px]" : "h-[72px] w-[50px]";
  if (count === 0) return <span className="text-xs italic text-white/40">нет карт</span>;
  return (
    <div className="relative flex items-end" style={{ width: shown * 10 + (size === "sm" ? 36 : 50) }}>
      {Array.from({ length: shown }).map((_, i) => {
        const isLast = i === shown - 1;
        return (
          <div
            key={i}
            className={[
              "absolute rounded-lg border border-white/20 bg-gradient-to-br from-[#1e3a5f] to-[#0d1f36] shadow",
              szCls
            ].join(" ")}
            style={{ left: i * 10, zIndex: i + 1 }}
          >
            {isLast && (
              <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 text-sm font-bold text-white">
                {count}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function DurakGame(): React.JSX.Element {
  const room      = useGameStore((s) => s.room);
  const gameState = useGameStore((s) => s.gameState);

  const [selCard, setSelCard]   = useState<string | null>(null);
  const [selPair, setSelPair]   = useState<string | null>(null);
  const [error,   setError]     = useState<string | null>(null);

  const state = useMemo(() => {
    if (!gameState || gameState.gameType !== "durak") return null;
    return gameState as DurakPlayerViewState;
  }, [gameState]);

  if (!room || !state) {
    return <div className="flex h-40 items-center justify-center text-muted-foreground">Загрузка игры...</div>;
  }

  const me         = window.localStorage.getItem("user_id") ?? "";
  const isAttacker = state.attackerId === me;
  const isDefender = state.defenderId === me;
  const gameOver   = !!state.reason;
  const canAct     = !gameOver;
  const myPhase    = (isAttacker && state.phase === "attack") || (isDefender && state.phase === "defend");

  const send = async (payload: DurakMovePayload) => {
    const r = await emitGameMove(payload);
    if (!r.ok) {
      const m = r.error;
      if (/card not found/i.test(m))      setError("Карта недоступна.");
      else if (/only attacker/i.test(m))  setError("Это действие для атакующего.");
      else if (/only defender/i.test(m))  setError("Это действие для защищающегося.");
      else setError(translateServerMessage(m));
      return;
    }
    setError(null); setSelCard(null); setSelPair(null);
  };

  const doAttack = () => {
    if (!selCard) { setError("Выберите карту для атаки."); return; }
    void send({ gameType: "durak", roomId: room.id, action: "attack", cardId: selCard });
  };
  const doDefend = () => {
    if (!selCard) { setError("Выберите карту защиты из руки."); return; }
    if (!selPair) { setError("Нажмите на атакующую карту на столе."); return; }
    void send({ gameType: "durak", roomId: room.id, action: "defend", cardId: selCard, targetPairId: selPair });
  };
  const doTake = () => void send({ gameType: "durak", roomId: room.id, action: "take" });
  const doPass = () => void send({ gameType: "durak", roomId: room.id, action: "pass" });

  const trumpSym = sym(state.trumpSuit);
  const trumpRed = isRed(state.trumpSuit);

  const others = (state.players as DPlayer[]).filter((p) => !p.isSelf);
  const table  = state.table as DPair[];

  // Status label
  const statusLabel = gameOver
    ? { text: translateServerMessage(state.reason ?? ""), cls: "bg-[#f2c94c]/20 text-[#f2c94c] border-[#f2c94c]/40" }
    : !myPhase
    ? { text: "Ожидание...", cls: "bg-white/5 text-white/50 border-white/10" }
    : isAttacker
    ? { text: "⚔  Ваш ход — атака", cls: "bg-orange-500/20 text-orange-300 border-orange-500/30" }
    : { text: "🛡  Ваш ход — защита", cls: "bg-blue-500/20 text-blue-300 border-blue-500/30" };

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl"
      style={{
        background: "radial-gradient(ellipse at 50% 30%, #1e4d30 0%, #122e1c 60%, #0b1e12 100%)",
        boxShadow: "inset 0 0 80px rgba(0,0,0,0.6), 0 8px 32px rgba(0,0,0,0.5)",
        minHeight: "clamp(520px, 90dvh, 900px)"
      }}
    >

      {/* ══ TOP: opponents + meta ════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-2">

        {/* Opponents */}
        <div className="flex flex-wrap gap-3">
          {others.map((p) => {
            const isAtk = state.attackerId === p.userId;
            const isDef = state.defenderId === p.userId;
            const label = isAtk ? "⚔" : isDef ? "🛡" : "";
            return (
              <div key={p.userId} className="flex flex-col items-center gap-1.5">
                <div className={[
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  isAtk ? "bg-orange-500/25 text-orange-300 ring-1 ring-orange-500/40"
                  : isDef ? "bg-blue-500/25 text-blue-300 ring-1 ring-blue-500/40"
                  : "bg-white/8 text-white/60"
                ].join(" ")}>
                  {label && <span>{label}</span>}
                  {p.username}
                </div>
                <FaceDownStack count={p.handCount} size="sm" />
              </div>
            );
          })}
        </div>

        {/* Deck + Trump */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Deck */}
          <div className="flex flex-col items-center gap-1">
            <div className="h-[52px] w-[36px] rounded-lg border border-white/20 bg-gradient-to-br from-[#1e3a5f] to-[#0d1f36] shadow flex items-center justify-center text-xs font-bold text-white">
              {state.deckCount}
            </div>
            <span className="text-[10px] text-white/40">колода</span>
          </div>

          {/* Trump */}
          <div className="flex flex-col items-center gap-1">
            <div className={[
              "flex h-[52px] w-[36px] items-center justify-center rounded-lg border-2 bg-white text-xl font-bold shadow",
              trumpRed ? "border-red-400 text-red-600" : "border-gray-400 text-gray-900"
            ].join(" ")}>
              {trumpSym}
            </div>
            <span className="text-[10px] text-white/40">козырь</span>
          </div>
        </div>
      </div>

      {/* ══ STATUS BAR ═══════════════════════════════════════════════════════ */}
      <div className="mx-4 mb-2">
        <div className={`rounded-xl border px-4 py-2 text-center text-sm font-semibold ${statusLabel.cls}`}>
          {statusLabel.text}
        </div>
      </div>

      {/* ══ TABLE ════════════════════════════════════════════════════════════ */}
      <div className="relative mx-4 flex-1 min-h-[140px]">
        {/* felt ring */}
        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />

        {table.length === 0 ? (
          <div className="flex h-full min-h-[140px] items-center justify-center">
            <p className="text-sm text-white/30">
              {isAttacker && canAct ? "Выберите карту и нажмите «Атака»" : "Стол пуст"}
            </p>
          </div>
        ) : (
          <div className="flex h-full min-h-[140px] flex-wrap items-center justify-center gap-x-4 gap-y-8 px-3 py-4 overflow-x-auto">
            {table.map((pair) => {
              const isTarget = selPair === pair.id;
              const undefended = !pair.defense;
              return (
                <div key={pair.id} className="relative shrink-0" style={{ width: 72, height: 100 }}>
                  {/* Attack card */}
                  <div
                    className={[
                      "absolute top-0 left-0",
                      isDefender && undefended && canAct ? "cursor-pointer" : ""
                    ].join(" ")}
                    onClick={() => {
                      if (isDefender && undefended && canAct) {
                        setSelPair(pair.id === selPair ? null : pair.id);
                        setError(null);
                      }
                    }}
                  >
                    <Card card={pair.attack} targeted={isTarget && undefended} size="md" />
                    {/* Undefended dot */}
                    {undefended && !isTarget && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-orange-400" />
                      </span>
                    )}
                  </div>
                  {/* Defense card */}
                  {pair.defense ? (
                    <div className="absolute" style={{ top: 14, left: 14, zIndex: 5 }}>
                      <Card card={pair.defense} size="md" />
                    </div>
                  ) : isTarget ? (
                    <div
                      className="absolute flex items-center justify-center rounded-lg border-2 border-dashed border-blue-400/60 bg-blue-500/10 text-xs font-semibold text-blue-300"
                      style={{ top: 14, left: 14, width: 60, height: 88, zIndex: 5 }}
                    >
                      сюда
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ ACTION BUTTONS ═══════════════════════════════════════════════════ */}
      <div className="mx-4 mt-3">
        {error ? (
          <div className="mb-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-center text-sm text-red-400">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-4 gap-2">
          {/* Attack */}
          <button
            type="button"
            onClick={doAttack}
            disabled={!isAttacker || !selCard || state.phase !== "attack" || !canAct}
            className={[
              "col-span-2 flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold",
              "transition-all duration-150 active:scale-95",
              "disabled:opacity-30 disabled:cursor-not-allowed",
              isAttacker && selCard && state.phase === "attack" && canAct
                ? "bg-orange-500 text-white shadow-[0_0_12px_rgba(249,115,22,0.4)] hover:bg-orange-400"
                : "bg-white/10 text-white/50"
            ].join(" ")}
          >
            <span className="text-base">⚔</span> Атака
          </button>

          {/* Defend */}
          <button
            type="button"
            onClick={doDefend}
            disabled={!isDefender || !selCard || !selPair || state.phase !== "defend" || !canAct}
            className={[
              "col-span-2 flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold",
              "transition-all duration-150 active:scale-95",
              "disabled:opacity-30 disabled:cursor-not-allowed",
              isDefender && selCard && selPair && state.phase === "defend" && canAct
                ? "bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.4)] hover:bg-blue-400"
                : "bg-white/10 text-white/50"
            ].join(" ")}
          >
            <span className="text-base">🛡</span> Отбить
          </button>

          {/* Take */}
          <button
            type="button"
            onClick={doTake}
            disabled={!isDefender || !canAct}
            className={[
              "col-span-2 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold",
              "transition-all duration-150 active:scale-95",
              "disabled:opacity-30 disabled:cursor-not-allowed",
              isDefender && canAct
                ? "bg-white/15 text-white hover:bg-white/20"
                : "bg-white/8 text-white/40"
            ].join(" ")}
          >
            📥 Взять
          </button>

          {/* Pass */}
          <button
            type="button"
            onClick={doPass}
            disabled={!isAttacker || table.length === 0 || !canAct}
            className={[
              "col-span-2 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold",
              "transition-all duration-150 active:scale-95",
              "disabled:opacity-30 disabled:cursor-not-allowed",
              isAttacker && table.length > 0 && canAct
                ? "bg-white/15 text-white hover:bg-white/20"
                : "bg-white/8 text-white/40"
            ].join(" ")}
          >
            ✓ Пас
          </button>
        </div>
      </div>

      {/* ══ MY HAND ══════════════════════════════════════════════════════════ */}
      <div className="mt-3 pb-4">
        {/* Label */}
        <div className="mb-2 flex items-center gap-2 px-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
            Ваши карты
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-white/60">
            {state.ownHand.length}
          </span>
          {selCard || selPair ? (
            <button
              type="button"
              onClick={() => { setSelCard(null); setSelPair(null); setError(null); }}
              className="ml-auto text-xs text-white/40 underline hover:text-white/70"
            >
              сбросить
            </button>
          ) : null}
        </div>

        {state.ownHand.length === 0 ? (
          <div className="px-4 text-sm text-white/30 italic">Карт нет</div>
        ) : (
          /* Horizontal scroll on mobile, wrap on desktop */
          <div
            className="flex gap-2 overflow-x-auto px-4 pb-1"
            style={{ WebkitOverflowScrolling: "touch", scrollSnapType: "x mandatory" }}
          >
            {state.ownHand.map((card) => (
              <div key={card.id} style={{ scrollSnapAlign: "start", flexShrink: 0 }}>
                <Card
                  card={card}
                  selected={selCard === card.id}
                  dim={!!selCard && selCard !== card.id && !myPhase}
                  onClick={() => {
                    if (!canAct || !myPhase) return;
                    setSelCard(card.id === selCard ? null : card.id);
                    setError(null);
                  }}
                  size="lg"
                />
              </div>
            ))}
          </div>
        )}

        {/* Hint */}
        {!gameOver && myPhase && !selCard && (
          <p className="mt-2 px-4 text-center text-xs text-white/30">
            {isAttacker ? "Нажмите на карту и нажмите «Атака»" : "Сначала нажмите атакующую карту на столе, затем выберите карту защиты"}
          </p>
        )}
      </div>
    </div>
  );
}
