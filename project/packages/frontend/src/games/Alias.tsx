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
  const timeLeft = state.roundEndsAtMs ? state.roundEndsAtMs - nowMs : 0;
  const roundActive = state.status === "ROUND" && state.roundEndsAtMs !== null;

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

  const canStartRound = state.status !== "ROUND" && room.status === "PLAYING";

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card>
        <CardHeader>
          <CardTitle>Alias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-[#23262a] p-3 text-sm text-muted-foreground">
            <div>Раунд: {state.round}</div>
            <div>Текущая команда: {currentTeam?.name ?? "-"}</div>
            <div>Слов в колоде: {state.deckCount}</div>
          </div>

          <div className="rounded-lg border border-border bg-[#1f1f22] p-3 text-center">
            <div className="text-xs uppercase text-muted-foreground">Слово для объяснения</div>
            <div className="mt-2 text-xl font-semibold text-foreground">
              {roundActive && isExplainer ? state.activeWord ?? "..." : "Скрыто"}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {roundActive ? `Время: ${formatSeconds(timeLeft)}` : "Раунд не начат"}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={!canStartRound} onClick={() => void sendAction("startRound")}>Начать раунд</Button>
            <Button disabled={!roundActive || !isExplainer} onClick={() => void sendAction("guess")}>Угадали</Button>
            <Button disabled={!roundActive || !isExplainer} variant="secondary" onClick={() => void sendAction("skip")}>Пропуск</Button>
            <Button disabled={!roundActive} variant="outline" onClick={() => void sendAction("endRound")}>Завершить раунд</Button>
          </div>

          {actionError ? (
            <div className="rounded-md border border-[#d35d5d]/40 bg-[#2c2020] p-2 text-sm text-[#d35d5d]">
              {actionError}
            </div>
          ) : null}
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
