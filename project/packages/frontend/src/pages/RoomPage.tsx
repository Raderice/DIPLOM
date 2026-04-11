import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  connectSocket,
  disconnectSocket,
  isTransientSocketIssue,
  joinRoom,
  leaveRoom,
  onRoomJoined,
  onRoomUpdate,
  onSocketError,
  setReady,
  startRoom
} from "../socket/client";
import { useGameStore } from "../store/gameStore";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { gameTypeRu, roomStatusRu, translateServerMessage } from "../lib/i18n";

export default function RoomPage(): React.JSX.Element {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const room = useGameStore((s) => s.room);
  const setRoom = useGameStore((s) => s.setRoom);
  const setPlayers = useGameStore((s) => s.setPlayers);
  const reset = useGameStore((s) => s.reset);
  const preserveSocketForGameRef = useRef(false);
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);

  const me = window.localStorage.getItem("user_id") ?? "";
  const myReady = Boolean(room?.players.find((p) => p.userId === me)?.ready);

  const canStart = useMemo(() => {
    if (!room) return false;
    if (room.hostId !== me) return false;
    return room.players.filter((p) => p.connected).every((p) => p.ready);
  }, [room, me]);

  useEffect(() => {
    if (!roomId) {
      navigate("/lobby");
      return;
    }

    const socket = connectSocket();

    const joinCurrentRoom = async () => {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const response = await joinRoom({ roomId });
        if (response.ok) {
          setConnectionNotice(null);
          return;
        }

        if (!isTransientSocketIssue(response.error)) {
          setConnectionNotice(translateServerMessage(response.error));
          navigate("/lobby");
          return;
        }

        setConnectionNotice(`Соединение нестабильно. Переподключение... попытка ${attempt}/3`);
        await new Promise((resolve) => window.setTimeout(resolve, 500 * attempt));
      }

      setConnectionNotice("Временная проблема сети. Остаемся в комнате и ждем переподключения.");
    };

    const onConnect = () => {
      void joinCurrentRoom();
    };

    const onDisconnect = () => {
      setConnectionNotice("Соединение потеряно. Ожидаем автоматическое переподключение...");
    };

    const offJoined = onRoomJoined(({ room: joinedRoom, selfId }) => {
      window.localStorage.setItem("user_id", selfId);
      setRoom(joinedRoom);
    });

    const offUpdate = onRoomUpdate(({ roomId: updatedRoomId, status, players }) => {
      if (updatedRoomId !== roomId) return;
      setPlayers(updatedRoomId, status as "WAITING" | "PLAYING" | "FINISHED", players);
      if (status === "PLAYING") {
        preserveSocketForGameRef.current = true;
        navigate(`/game/${roomId}`);
        return;
      }

      if (status === "FINISHED") {
        setConnectionNotice("Хост покинул комнату. Возврат в лобби...");
        window.setTimeout(() => navigate("/lobby"), 900);
      }
    });

    const offSocketError = onSocketError((message) => {
      setConnectionNotice(translateServerMessage(message));
    });

    if (socket.connected) {
      void joinCurrentRoom();
    } else {
      socket.on("connect", onConnect);
      socket.on("disconnect", onDisconnect);
      socket.connect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      offJoined();
      offUpdate();
      offSocketError();
      if (!preserveSocketForGameRef.current) {
        disconnectSocket();
        reset();
      }
    };
  }, [navigate, reset, roomId, setPlayers, setRoom]);

  if (!roomId) {
    return <div className="p-6">Идентификатор комнаты не найден</div>;
  }

  const onReady = async () => {
    const response = await setReady({ roomId, ready: !myReady });
    if (!response.ok) {
      setConnectionNotice(translateServerMessage(response.error));
      return;
    }
  };

  const onStart = async () => {
    const response = await startRoom(roomId);
    if (!response.ok) {
      setConnectionNotice(translateServerMessage(response.error));
      return;
    }
    preserveSocketForGameRef.current = true;
    navigate(`/game/${roomId}`);
  };

  const onBackToLobby = async () => {
    const response = await leaveRoom(roomId);
    if (!response.ok) {
      setConnectionNotice(translateServerMessage(response.error));
      return;
    }
    navigate("/lobby");
  };

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{room?.name ?? "Загрузка комнаты..."}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>ID комнаты: {roomId}</p>
          <p>Игра: {room ? gameTypeRu(room.gameType) : "-"}</p>
          <p>Статус: {room ? roomStatusRu(room.status) : roomStatusRu("WAITING")}</p>
          <p>Код приглашения: {room?.inviteCode ?? "-"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Игроки</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {(room?.players ?? []).map((player) => (
              <li key={player.userId} className="rounded-xl border border-cyan-100 bg-white/80 px-3 py-2 text-sm">
                <div className="font-medium">
                  {player.username}
                  {room?.hostId === player.userId ? " (хост)" : ""}
                </div>
                <div className="text-slate-600">
                  {player.connected ? "в сети" : "не в сети"} • {player.ready ? "готов" : "не готов"}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void onReady()}>{myReady ? "Не готов" : "Готов"}</Button>
        <Button variant="secondary" onClick={() => void onStart()} disabled={!canStart || room?.status !== "WAITING"}>
          Начать игру
        </Button>
        <Button variant="outline" onClick={() => void onBackToLobby()}>Назад в лобби</Button>
      </div>

      {connectionNotice ? (
        <div className="rounded-md border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900">{connectionNotice}</div>
      ) : null}
    </main>
  );
}
