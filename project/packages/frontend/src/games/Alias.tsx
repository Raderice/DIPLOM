import { useEffect, useMemo, useState } from "react";
import type { AliasMovePayload, AliasState } from "@board-games/shared";
import { emitGameMove } from "../socket/client";
import { useGameStore } from "../store/gameStore";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { translateServerMessage } from "../lib/i18n";

function formatSeconds(totalMs: number): string {
  const total = Math.max(0, Math.floor(totalMs / 1000));
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function AliasGame(): React.JSX.Element {
  const room = useGameStore((s) => s.room);
  const gameState = useGameStore((s) => s.gameState);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [actionError, setActionError] = useState<string | null>(null);

  const state = useMemo(() => {
    if (!gameState || gameState.gameType !== "alias") return null;
    return gameState as AliasState;
  }, [gameState]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 300);
    return () => window.clearInterval(intervalId);
  }, []);

  if (!room || !state) {
    return <div className="rounded-lg border p-4">Состояние Alias недоступно.</div>;
  }

  const me = window.localStorage.getItem("user_id") ?? "";
  const currentTeam = state.teams[state.currentTeamIndex];
  const isExplainer = state.explainerId === me;
  const isCurrentTeam = currentTeam?.playerIds.includes(me) ?? false;
  const timeLeft = state.roundEndsAtMs ? Math.max(0, state.roundEndsAtMs - nowMs) : 0;
  const roundActive = state.status === "ROUND" && state.roundEndsAtMs !== null && timeLeft > 0;

  const sendAction = async (action: AliasMovePayload["action"]) => {
    const payload: AliasMovePayload = {
      gameType: "alias",
      roomId: room.id,
      action
    };
    const result = await emitGameMove(payload);
    if (!result.ok) {
      setActionError(translateServerMessage(result.error));
      return;
    }
    setActionError(null);
  };

  const canStartRound = state.status !== "ROUND" && room.status === "PLAYING" && isCurrentTeam;

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Card>
        <CardHeader>
          <CardTitle>Alias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Meta info */}
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg border border-border bg-muted/30 px-2 py-2">
              <div className="text-xs text-muted-foreground">Раунд</div>
              <div className="font-bold text-foreground">{state.round}</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-2 py-2">
              <div className="text-xs text-muted-foreground">Ходит</div>
              <div className="font-bold text-foreground truncate">{currentTeam?.name ?? "—"}</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-2 py-2">
              <div className="text-xs text-muted-foreground">Карточек</div>
              <div className="font-bold text-foreground">{state.deckCount + state.discardCount}</div>
            </div>
          </div>

          {/* Explainer badge */}
          {state.explainerId && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-center">
              <span className="text-muted-foreground">Объясняет: </span>
              <span className="font-semibold text-foreground">
                {isExplainer ? "Вы" : (
                  state.teams.flatMap(t => t.playerIds).includes(state.explainerId ?? "")
                    ? state.explainerId
                    : state.explainerId
                )}
              </span>
            </div>
          )}

          {/* Word + timer */}
          <div className={[
            "rounded-lg border p-4 text-center",
            roundActive && isExplainer ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20"
          ].join(" ")}>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              {isExplainer ? "Ваше слово" : "Слово"}
            </div>
            <div className={[
              "text-2xl font-bold",
              roundActive && isExplainer ? "text-foreground" : "text-muted-foreground/40"
            ].join(" ")}>
              {roundActive && isExplainer ? (state.activeWord ?? "...") : "— — —"}
            </div>
            <div className={[
              "mt-2 text-lg font-mono font-semibold tabular-nums",
              timeLeft < 10_000 && roundActive ? "text-red-400" : "text-muted-foreground"
            ].join(" ")}>
              {state.status === "ROUND" ? formatSeconds(timeLeft) : "—:——"}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              className="col-span-2"
              disabled={!canStartRound}
              onClick={() => void sendAction("startRound")}
            >
              ▶ Начать раунд
            </Button>
            <Button
              disabled={!roundActive || !isExplainer}
              onClick={() => void sendAction("guess")}
            >
              ✓ Угадали
            </Button>
            <Button
              disabled={!roundActive || !isExplainer}
              variant="secondary"
              onClick={() => void sendAction("skip")}
            >
              → Пропуск
            </Button>
            <Button
              className="col-span-2"
              disabled={state.status !== "ROUND" || !isCurrentTeam}
              variant="outline"
              onClick={() => void sendAction("endRound")}
            >
              Завершить раунд
            </Button>
          </div>

          {actionError ? (
            <div className="rounded-md border border-[#d35d5d]/40 bg-[#2c2020] p-2 text-sm text-[#d35d5d]">
              {actionError}
            </div>
          ) : null}

          {!isCurrentTeam && state.status !== "ROUND" && state.status !== "ENDED" && (
            <p className="text-center text-xs text-muted-foreground">Ожидайте — сейчас ход команды {currentTeam?.name}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Команды</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {state.teams.map((team) => (
            <div
              key={team.id}
              className={`rounded-lg border px-3 py-2 ${
                team.id === state.currentTeamId
                  ? "border-[#f2c94c]/60 bg-[#2f2a1b] text-[#f2c94c]"
                  : "border-border bg-[#23262a]"
              }`}
            >
              <div className="font-medium text-foreground">{team.name}</div>
              <div className="text-muted-foreground">Счет: {team.score}</div>
              <div className="text-xs text-muted-foreground">Игроки: {team.playerIds.length}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
