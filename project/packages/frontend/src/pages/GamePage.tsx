import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  connectSocket,
  disconnectSocket,
  emitChatMessage,
  isTransientSocketIssue,
  joinRoom,
  leaveRoom,
  onChatMessage,
  onGameOver,
  onGameState,
  onPlayerDisconnected,
  onPlayerReconnected,
  onRoomJoined,
  onRoomUpdate,
  onSocketError,
  setReady,
  startRoom
} from "../socket/client";
import { useGameStore } from "../store/gameStore";
import { ChessGame } from "../games/Chess";
import { CheckersGame } from "../games/Checkers";
import { DurakGame } from "../games/Durak";
import { AliasGame } from "../games/Alias";
import { MafiaGame } from "../games/Mafia";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { roomStatusRu, translateServerMessage } from "../lib/i18n";
import { gamePlayerCountMessage, validateGamePlayerCount } from "@board-games/shared";

export default function GamePage(): React.JSX.Element {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const room = useGameStore((s) => s.room);
  const gameState = useGameStore((s) => s.gameState);
  const chat = useGameStore((s) => s.chat);
  const connected = useGameStore((s) => s.connected);
  const loading = useGameStore((s) => s.loading);
  const setConnected = useGameStore((s) => s.setConnected);
  const setLoading = useGameStore((s) => s.setLoading);
  const setRoom = useGameStore((s) => s.setRoom);
  const setPlayers = useGameStore((s) => s.setPlayers);
  const setGameState = useGameStore((s) => s.setGameState);
  const pushChatMessage = useGameStore((s) => s.pushChatMessage);
  const resetStore = useGameStore((s) => s.reset);

  const [chatInput, setChatInput] = useState("");
  const [gameOverNotice, setGameOverNotice] = useState<string | null>(null);
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) {
      navigate("/lobby");
      return;
    }

    setLoading(true);
    const socket = connectSocket();

    const offRoomJoined = onRoomJoined(({ room: joinedRoom, selfId }) => {
      window.localStorage.setItem("user_id", selfId);
      setRoom(joinedRoom);
      setLoading(false);
      setConnected(true);
    });

    const offRoomUpdate = onRoomUpdate(({ roomId: updatedRoomId, status, players }) => {
      if (updatedRoomId !== roomId) return;
      setPlayers(updatedRoomId, status as "WAITING" | "PLAYING" | "FINISHED", players);
    });

    const offGameState = onGameState(({ roomId: updatedRoomId, state }) => {
      if (updatedRoomId !== roomId) return;
      setGameState(state);
    });

    const offChat = onChatMessage((message) => {
      if (message.roomId !== roomId) return;
      pushChatMessage(message);
    });

    const offGameOver = onGameOver((payload) => {
      if (payload.roomId !== roomId) return;
      const me = window.localStorage.getItem("user_id") ?? "";
      const message =
        payload.reason === "player-left"
          ? payload.winnerId === me
            ? "Соперник вышел из матча. Победа присуждена вам. Возврат в лобби..."
            : "Вы вышли из матча. Поражение техническим поражением. Возврат в лобби..."
          : `Игра завершена: ${translateServerMessage(payload.reason)}. Возврат в лобби...`;

      setGameOverNotice(message);
      window.setTimeout(() => {
        navigate("/lobby");
      }, 1800);
    });

    const offDisconnected = onPlayerDisconnected((payload) => {
      if (payload.roomId !== roomId) return;
      setConnectionNotice(`Игрок ${payload.userId} отключился. Ожидаем переподключение...`);
    });

    const offReconnected = onPlayerReconnected((payload) => {
      if (payload.roomId !== roomId) return;
      setConnectionNotice(`Игрок ${payload.userId} переподключился.`);
    });

    const offSocketError = onSocketError((message) => {
      setConnected(socket.connected);
      setConnectionNotice(message);
    });

    const joinCurrentRoom = async () => {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const response = await joinRoom({ roomId });
        if (response.ok) {
          setLoading(false);
          setConnectionNotice(null);
          return;
        }

        if (!isTransientSocketIssue(response.error)) {
          setLoading(false);
          setConnectionNotice(translateServerMessage(response.error));
          navigate("/lobby");
          return;
        }

        setConnectionNotice(`Соединение нестабильно. Переподключение... попытка ${attempt}/3`);
        await new Promise((resolve) => window.setTimeout(resolve, 500 * attempt));
      }

      setLoading(false);
      setConnectionNotice("Временная проблема сети. Остаемся в игре и ждем переподключения.");
    };

    const onConnect = () => {
      setConnected(true);
      setConnectionNotice(null);
      void joinCurrentRoom();
    };

    const onDisconnect = () => {
      setConnected(false);
      setConnectionNotice("Соединение потеряно. Ожидаем автоматическое переподключение...");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (socket.connected) {
      void joinCurrentRoom();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      offRoomJoined();
      offRoomUpdate();
      offGameState();
      offChat();
      offGameOver();
      offDisconnected();
      offReconnected();
      offSocketError();
      disconnectSocket();
      resetStore();
    };
  }, [
    roomId,
    navigate,
    setConnected,
    setGameState,
    setLoading,
    setPlayers,
    setRoom,
    pushChatMessage,
    resetStore
  ]);

  if (!roomId) {
    return <div className="p-6">Идентификатор комнаты не найден.</div>;
  }

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text) return;
    const response = await emitChatMessage({ roomId, text });
    if (!response.ok) {
      setActionNotice(translateServerMessage(response.error));
      return;
    }
    setActionNotice(null);
    setChatInput("");
  };

  const toggleReady = async () => {
    const response = await setReady({ roomId, ready: !myReady });
    if (!response.ok) {
      setActionNotice(translateServerMessage(response.error));
      return;
    }
    setActionNotice(null);
  };

  const onStart = async () => {
    if (room) {
      const connectedPlayers = room.players.filter((p) => p.connected);
      const check = validateGamePlayerCount(room.gameType, connectedPlayers.length);
      if (!check.ok) {
        setActionNotice(translateServerMessage(check.message ?? gamePlayerCountMessage(room.gameType)));
        return;
      }
    }
    const response = await startRoom(roomId);
    if (!response.ok) {
      setActionNotice(translateServerMessage(response.error));
      return;
    }
    setActionNotice(null);
  };

  const onBackToLobby = async () => {
    const response = await leaveRoom(roomId);
    if (!response.ok) {
      setActionNotice(translateServerMessage(response.error));
      return;
    }
    setActionNotice(null);
    navigate("/lobby");
  };

  const renderGame = (): React.JSX.Element => {
    if (!room || !gameState) {
      return <div className="rounded-lg border p-4">Загрузка игры...</div>;
    }
    if (room.gameType === "chess") return <ChessGame />;
    if (room.gameType === "checkers") return <CheckersGame />;
    if (room.gameType === "durak") return <DurakGame />;
    if (room.gameType === "alias") return <AliasGame />;
    return <MafiaGame />;
  };

  const me = window.localStorage.getItem("user_id") ?? "";
  const myReady = Boolean(room?.players.find((p) => p.userId === me)?.ready);
  const canStart = Boolean(room && room.hostId === me && room.players.filter((p) => p.connected).every((p) => p.ready));

  return (
    <main className="mx-auto grid max-w-7xl gap-4 p-4 md:p-6 lg:grid-cols-[1fr_320px]">
      <section className="space-y-4">
        <Card className="overflow-hidden">
          <div className="border-b border-border bg-[#23262a] px-6 py-4">
            <h2 className="font-display text-lg font-semibold tracking-wide text-foreground">
              {room?.name ?? "Загрузка комнаты..."}
            </h2>
          </div>
          <CardHeader>
            <CardTitle>Управление матчем</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="rounded-lg border border-border bg-[#23262a] px-3 py-2 text-sm text-muted-foreground">
              Комната: {roomId} | Статус: {roomStatusRu(room?.status ?? "WAITING")} | Сокет: {connected ? "подключен" : "отключен"}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void toggleReady()}>{myReady ? "Не готов" : "Готов"}</Button>
              <Button variant="secondary" disabled={!canStart || room?.status !== "WAITING"} onClick={() => void onStart()}>
                Начать игру
              </Button>
              <Button variant="outline" onClick={() => void onBackToLobby()}>Назад в лобби</Button>
            </div>

            {gameOverNotice ? (
              <div className="rounded-md border border-[#f2c94c]/40 bg-[#2f2a1b] p-3 text-sm text-[#f2c94c]">
                {gameOverNotice}
              </div>
            ) : null}

            {connectionNotice ? (
              <div className="rounded-md border border-[#f2c94c]/40 bg-[#2f2a1b] p-3 text-sm text-[#f2c94c]">
                {connectionNotice}
              </div>
            ) : null}

            {actionNotice ? (
              <div className="rounded-md border border-[#d35d5d]/40 bg-[#2c2020] p-3 text-sm text-[#d35d5d]">
                {actionNotice}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <section>{loading ? <div className="rounded-lg border p-4">Подключение к комнате...</div> : renderGame()}</section>
      </section>

      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Игроки</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(room?.players ?? []).map((p) => (
                <li key={p.userId} className="rounded-xl border border-border bg-[#23262a] px-3 py-2 text-sm">
                  <div className="font-medium">
                    {p.username}
                    {room?.hostId === p.userId ? " (хост)" : ""}
                  </div>
                  <div className="text-muted-foreground">
                    {p.connected ? "в сети" : "не в сети"} | {p.ready ? "готов" : "не готов"}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Чат</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 space-y-2 overflow-y-auto rounded-xl border border-border bg-[#1f2124] p-2">
              {chat.map((m) => (
                <div key={m.id} className="text-sm">
                  <span className="font-semibold">{m.username}: </span>
                  <span>{m.text}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void sendChat();
                  }
                }}
                placeholder="Введите сообщение + эмодзи"
              />
              <Button onClick={() => void sendChat()}>Отправить</Button>
            </div>
          </CardContent>
        </Card>
      </aside>
    </main>
  );
}
