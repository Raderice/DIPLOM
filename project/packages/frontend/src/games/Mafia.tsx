import { useMemo, useState } from "react";
import type { MafiaMovePayload, MafiaState } from "@board-games/shared";
import { emitGameMove } from "../socket/client";
import { useGameStore } from "../store/gameStore";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { translateServerMessage } from "../lib/i18n";

const ROLE_LABEL: Record<string, string> = {
  mafia: "Мафия",
  civilian: "Мирный",
  doctor: "Доктор",
  sheriff: "Шериф"
};

const ROLE_ICON: Record<string, string> = {
  mafia: "🔫",
  civilian: "👤",
  doctor: "💊",
  sheriff: "🔍"
};

const PHASE_LABEL: Record<string, string> = {
  night: "🌙 Ночь",
  day: "☀️ День",
  ended: "🏁 Игра завершена"
};

export function MafiaGame(): React.JSX.Element {
  const room      = useGameStore((s) => s.room);
  const gameState = useGameStore((s) => s.gameState);
  const [targetId, setTargetId]       = useState<string>("");
  const [actionError, setActionError] = useState<string | null>(null);

  const state = useMemo(() => {
    if (!gameState || gameState.gameType !== "mafia") return null;
    return gameState as MafiaState;
  }, [gameState]);

  const me          = window.localStorage.getItem("user_id") ?? "";
  const self        = state?.players.find((p) => p.userId === me);
  const isHost      = room?.hostId === me;
  const isAlive     = self?.alive ?? false;
  const myRole      = self?.role ?? null;
  const alivePlayers = state?.players.filter((p) => p.alive) ?? [];

  const mafiaPlayers = state?.players.filter((p) => p.role === "mafia" && p.alive) ?? [];

  const voteCount = useMemo(() => {
    const map = new Map<string, number>();
    if (!state) return map;
    for (const targetVoteId of Object.values(state.dayVotes)) {
      map.set(targetVoteId, (map.get(targetVoteId) ?? 0) + 1);
    }
    return map;
  }, [state]);

  if (!room || !state) {
    return <div className="rounded-lg border p-4">Состояние Мафии недоступно.</div>;
  }

  // Targets filtered per action type
  const nightMafiaTargets = alivePlayers.filter(
    (p) => p.userId !== me && p.role !== "mafia"
  );
  const nightSheriffTargets = alivePlayers.filter((p) => p.userId !== me);
  const doctorTargets       = alivePlayers;
  const dayVoteTargets      = alivePlayers.filter((p) => p.userId !== me);

  const sendAction = async (action: MafiaMovePayload["action"]) => {
    const payload: MafiaMovePayload = {
      gameType: "mafia",
      roomId: room.id,
      action,
      ...(targetId ? { targetId } : {})
    };
    const result = await emitGameMove(payload);
    if (!result.ok) {
      setActionError(translateServerMessage(result.error));
      return;
    }
    setActionError(null);
    setTargetId("");
  };

  const usernameOf = (userId: string) =>
    state.players.find((p) => p.userId === userId)?.username ?? userId;

  const myDayVote = state.dayVotes[me];

  const eliminated = state.lastEliminatedId
    ? state.players.find((p) => p.userId === state.lastEliminatedId)
    : null;

  const isNight = state.phase === "night";
  const isDay   = state.phase === "day";
  const isEnded = state.phase === "ended";

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">

      {/* ── Main card ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Мафия</CardTitle>
            <span className={[
              "rounded-full border px-3 py-1 text-sm font-semibold",
              isNight ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-300"
              : isDay  ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
              :          "border-border bg-muted text-muted-foreground"
            ].join(" ")}>
              {PHASE_LABEL[state.phase] ?? state.phase} {isNight ? state.night : isDay ? state.day : ""}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* My role */}
          <div className={[
            "rounded-xl border px-4 py-3 text-center",
            myRole === "mafia"   ? "border-red-500/40 bg-red-500/10"
            : myRole === "doctor"  ? "border-green-500/40 bg-green-500/10"
            : myRole === "sheriff" ? "border-blue-500/40 bg-blue-500/10"
            :                        "border-border bg-muted/30"
          ].join(" ")}>
            <div className="text-xs text-muted-foreground mb-1">Ваша роль</div>
            <div className="text-xl font-bold text-foreground">
              {myRole ? `${ROLE_ICON[myRole]} ${ROLE_LABEL[myRole]}` : "—"}
            </div>
            {!isAlive && <div className="mt-1 text-xs text-red-400">Вы выбыли</div>}
          </div>

          {/* Mafia teammates */}
          {myRole === "mafia" && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm">
              <div className="text-xs text-muted-foreground mb-1">Соратники мафии</div>
              <div className="font-semibold text-red-300">
                {mafiaPlayers.filter((p) => p.userId !== me).map((p) => p.username).join(", ") || "Вы один"}
              </div>
            </div>
          )}

          {/* Sheriff result */}
          {state.sheriffResult && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm">
              <div className="text-xs text-muted-foreground mb-1">🔍 Результат проверки</div>
              <div className="font-semibold text-foreground">
                {usernameOf(state.sheriffResult.targetId)}
                {" — "}
                <span className={state.sheriffResult.role === "mafia" ? "text-red-400" : "text-green-400"}>
                  {ROLE_ICON[state.sheriffResult.role]} {ROLE_LABEL[state.sheriffResult.role]}
                </span>
              </div>
            </div>
          )}

          {/* Last eliminated */}
          {eliminated && (
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Выбыл: </span>
              <span className="font-semibold text-foreground">{eliminated.username}</span>
              {eliminated.role && (
                <span className="ml-2 text-muted-foreground">
                  ({ROLE_ICON[eliminated.role]} {ROLE_LABEL[eliminated.role]})
                </span>
              )}
            </div>
          )}

          {/* Winner */}
          {isEnded && state.winner && (
            <div className={[
              "rounded-xl border px-4 py-3 text-center font-bold text-lg",
              state.winner === "mafia"
                ? "border-red-500/40 bg-red-500/10 text-red-300"
                : "border-green-500/40 bg-green-500/10 text-green-300"
            ].join(" ")}>
              {state.winner === "mafia" ? "🔫 Мафия победила!" : "🏆 Мирные победили!"}
            </div>
          )}

          {/* Target selector */}
          {!isEnded && isAlive && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Выберите цель</label>
              <select
                className="h-11 w-full rounded-xl border border-input bg-muted/30 px-3 text-sm text-foreground"
                value={targetId}
                onChange={(e) => { setTargetId(e.target.value); setActionError(null); }}
              >
                <option value="">— выберите игрока —</option>
                {isNight && myRole === "mafia" && nightMafiaTargets.map((p) => (
                  <option key={p.userId} value={p.userId}>{p.username}</option>
                ))}
                {isNight && myRole === "doctor" && doctorTargets.map((p) => (
                  <option key={p.userId} value={p.userId}>{p.username}{p.isSelf ? " (вы)" : ""}</option>
                ))}
                {isNight && myRole === "sheriff" && nightSheriffTargets.map((p) => (
                  <option key={p.userId} value={p.userId}>{p.username}</option>
                ))}
                {isDay && dayVoteTargets.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.username}{voteCount.get(p.userId) ? ` (${voteCount.get(p.userId)} голос.)` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action buttons */}
          {!isEnded && (
            <div className="grid grid-cols-2 gap-2">
              {isNight && myRole === "mafia" && isAlive && (
                <Button
                  className="col-span-2"
                  disabled={!targetId}
                  onClick={() => void sendAction("night:mafia")}
                >
                  🔫 Голос мафии
                </Button>
              )}
              {isNight && myRole === "doctor" && isAlive && (
                <Button
                  className="col-span-2"
                  variant="secondary"
                  disabled={!targetId}
                  onClick={() => void sendAction("night:doctor")}
                >
                  💊 Спасти
                </Button>
              )}
              {isNight && myRole === "sheriff" && isAlive && (
                <Button
                  className="col-span-2"
                  variant="secondary"
                  disabled={!targetId}
                  onClick={() => void sendAction("night:sheriff")}
                >
                  🔍 Проверить
                </Button>
              )}
              {isDay && isAlive && (
                <Button
                  className="col-span-2"
                  variant="secondary"
                  disabled={!targetId || !!myDayVote}
                  onClick={() => void sendAction("day:vote")}
                >
                  {myDayVote
                    ? `✓ Вы проголосовали за ${usernameOf(myDayVote)}`
                    : "🗳 Проголосовать"}
                </Button>
              )}
              {isHost && isNight && (
                <Button className="col-span-2" variant="outline" onClick={() => void sendAction("night:resolve")}>
                  Завершить ночь
                </Button>
              )}
              {isHost && isDay && (
                <Button className="col-span-2" variant="outline" onClick={() => void sendAction("day:resolve")}>
                  Завершить день ({Object.keys(state.dayVotes).length}/{alivePlayers.length} голосов)
                </Button>
              )}
            </div>
          )}

          {actionError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {actionError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Players sidebar ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Игроки</CardTitle>
            <span className="text-xs text-muted-foreground">
              {alivePlayers.length} живых
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {state.players.map((player) => {
            const votes = voteCount.get(player.userId) ?? 0;
            const hasVotedFor = state.dayVotes[me] === player.userId;
            return (
              <button
                key={player.userId}
                type="button"
                disabled={!player.alive || !isAlive || isEnded}
                onClick={() => {
                  if (player.alive && isAlive && !isEnded) {
                    setTargetId(player.userId === targetId ? "" : player.userId);
                  }
                }}
                className={[
                  "w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                  !player.alive
                    ? "border-red-500/20 bg-red-500/5 opacity-50"
                    : targetId === player.userId
                      ? "border-primary/60 bg-primary/10"
                      : "border-border bg-muted/20 hover:bg-muted/40",
                  player.isSelf ? "ring-1 ring-primary/30" : ""
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${player.alive ? "bg-green-500" : "bg-red-500"}`} />
                    <span className="font-medium text-foreground">
                      {player.username}
                      {player.isSelf && <span className="ml-1 text-xs text-muted-foreground">(вы)</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isDay && votes > 0 && (
                      <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs font-bold text-amber-300">
                        {votes}
                      </span>
                    )}
                    {hasVotedFor && <span className="text-xs text-primary">✓</span>}
                  </div>
                </div>
                {player.role && (
                  <div className={[
                    "mt-0.5 text-xs",
                    player.role === "mafia" ? "text-red-400"
                    : player.role === "doctor" ? "text-green-400"
                    : player.role === "sheriff" ? "text-blue-400"
                    : "text-muted-foreground"
                  ].join(" ")}>
                    {ROLE_ICON[player.role]} {ROLE_LABEL[player.role]}
                  </div>
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
