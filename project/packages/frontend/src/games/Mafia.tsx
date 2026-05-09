import { useMemo, useState } from "react";
import type { MafiaMovePayload, MafiaState } from "@board-games/shared";
import { emitGameMove } from "../socket/client";
import { useGameStore } from "../store/gameStore";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { translateServerMessage } from "../lib/i18n";

export function MafiaGame(): React.JSX.Element {
  const room = useGameStore((s) => s.room);
  const gameState = useGameStore((s) => s.gameState);
  const [targetId, setTargetId] = useState<string>("");
  const [actionError, setActionError] = useState<string | null>(null);

  const state = useMemo(() => {
    if (!gameState || gameState.gameType !== "mafia") return null;
    return gameState as MafiaState;
  }, [gameState]);

  if (!room || !state) {
    return <div className="rounded-lg border p-4">Состояние Мафии недоступно.</div>;
  }

  const me = window.localStorage.getItem("user_id") ?? "";
  const self = state.players.find((p) => p.userId === me);
  const isHost = room.hostId === me;
  const alivePlayers = state.players.filter((p) => p.alive);

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
  };

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Мафия</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="rounded-lg border border-border bg-[#23262a] p-3">
            <div>Фаза: {state.phase}</div>
            <div>Ночь: {state.night}</div>
            <div>День: {state.day}</div>
            <div>Ваша роль: {self?.role ?? "-"}</div>
          </div>

          {state.sheriffResult ? (
            <div className="rounded-lg border border-[#f2c94c]/40 bg-[#2f2a1b] p-3 text-[#f2c94c]">
              Результат проверки: {state.sheriffResult.targetId} ({state.sheriffResult.role})
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Цель</label>
            <select
              className="h-11 w-full rounded-xl border border-input bg-[#1f1f22] px-3 text-sm text-foreground"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">Выберите игрока</option>
              {alivePlayers.map((player) => (
                <option key={player.userId} value={player.userId}>
                  {player.username} ({player.userId === me ? "вы" : "игрок"})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={state.phase !== "night" || self?.role !== "mafia" || !targetId} onClick={() => void sendAction("night:mafia")}>
              Голос мафии
            </Button>
            <Button disabled={state.phase !== "night" || self?.role !== "doctor" || !targetId} onClick={() => void sendAction("night:doctor")}>
              Спасти
            </Button>
            <Button disabled={state.phase !== "night" || self?.role !== "sheriff" || !targetId} onClick={() => void sendAction("night:sheriff")}>
              Проверить
            </Button>
            <Button disabled={state.phase !== "day" || !targetId} variant="secondary" onClick={() => void sendAction("day:vote")}>
              Голос днем
            </Button>
            {isHost && state.phase === "night" ? (
              <Button variant="outline" onClick={() => void sendAction("night:resolve")}>Завершить ночь</Button>
            ) : null}
            {isHost && state.phase === "day" ? (
              <Button variant="outline" onClick={() => void sendAction("day:resolve")}>Завершить день</Button>
            ) : null}
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
          <CardTitle>Игроки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {state.players.map((player) => (
            <div
              key={player.userId}
              className={`rounded-lg border px-3 py-2 ${
                player.alive ? "border-border bg-[#23262a]" : "border-[#d35d5d]/40 bg-[#2c2020]"
              }`}
            >
              <div className="font-medium text-foreground">
                {player.username} {player.isSelf ? "(вы)" : ""}
              </div>
              <div className="text-muted-foreground">
                {player.alive ? "жив" : "выбыл"}
                {player.role ? ` • ${player.role}` : ""}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
