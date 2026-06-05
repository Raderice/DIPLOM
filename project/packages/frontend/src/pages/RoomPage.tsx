import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  connectSocket, disconnectSocket, isTransientSocketIssue,
  joinRoom, leaveRoom, onRoomJoined, onRoomUpdate, onSocketError, setReady, startRoom
} from "../socket/client";
import { useGameStore } from "../store/gameStore";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { gameTypeRu, roomStatusRu, translateServerMessage } from "../lib/i18n";
import { gamePlayerCountMessage, validateGamePlayerCount } from "@board-games/shared";
import QRCode from "qrcode";

const GAME_ICONS: Record<string, string> = {
  chess: "♟", checkers: "⬤", durak: "♠", alias: "💬", mafia: "🎭"
};

export default function RoomPage(): React.JSX.Element {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate   = useNavigate();

  const room      = useGameStore((s) => s.room);
  const setRoom   = useGameStore((s) => s.setRoom);
  const setPlayers= useGameStore((s) => s.setPlayers);
  const reset     = useGameStore((s) => s.reset);

  const preserveSocketRef = useRef(false);
  const [notice,   setNotice]   = useState<string | null>(null);
  const [showQr,   setShowQr]   = useState(false);
  const [qrDataUrl,setQrDataUrl]= useState<string | null>(null);

  const me      = window.localStorage.getItem("user_id") ?? "";
  const myReady = Boolean(room?.players.find((p) => p.userId === me)?.ready);

  const canStart = useMemo(() => {
    if (!room || room.hostId !== me) return false;
    const connected = room.players.filter((p) => p.connected);
    if (!validateGamePlayerCount(room.gameType, connected.length).ok) return false;
    return connected.every((p) => p.ready);
  }, [room, me]);

  useEffect(() => {
    if (!roomId) { navigate("/lobby"); return; }
    const socket = connectSocket();

    const join = async () => {
      for (let i = 1; i <= 3; i++) {
        const r = await joinRoom({ roomId });
        if (r.ok) { setNotice(null); return; }
        if (!isTransientSocketIssue(r.error)) { setNotice(translateServerMessage(r.error)); navigate("/lobby"); return; }
        setNotice(`Переподключение... попытка ${i}/3`);
        await new Promise((res) => window.setTimeout(res, 500 * i));
      }
      setNotice("Временная проблема сети. Ожидаем переподключения.");
    };

    const offJoined = onRoomJoined(({ room: r, selfId }) => {
      window.localStorage.setItem("user_id", selfId);
      setRoom(r);
    });

    const offUpdate = onRoomUpdate(({ roomId: rid, status, players }) => {
      if (rid !== roomId) return;
      setPlayers(rid, status as "WAITING" | "PLAYING" | "FINISHED", players);
      if (status === "PLAYING") { preserveSocketRef.current = true; navigate(`/game/${roomId}`); }
      if (status === "FINISHED") { setNotice("Хост покинул комнату."); window.setTimeout(() => navigate("/lobby"), 900); }
    });

    const offErr = onSocketError((msg) => setNotice(translateServerMessage(msg)));

    if (socket.connected) void join();
    else {
      socket.on("connect",    () => void join());
      socket.on("disconnect", () => setNotice("Соединение потеряно. Переподключение..."));
    }

    return () => {
      socket.off("connect"); socket.off("disconnect");
      offJoined(); offUpdate(); offErr();
      if (!preserveSocketRef.current) { disconnectSocket(); reset(); }
    };
  }, [navigate, reset, roomId, setPlayers, setRoom]);

  if (!roomId) return <div className="p-6">Идентификатор комнаты не найден</div>;

  const onReady = async () => {
    const r = await setReady({ roomId, ready: !myReady });
    if (!r.ok) setNotice(translateServerMessage(r.error));
  };

  const onStart = async () => {
    if (room) {
      const connected = room.players.filter((p) => p.connected);
      const check = validateGamePlayerCount(room.gameType, connected.length);
      if (!check.ok) { setNotice(translateServerMessage(check.message ?? gamePlayerCountMessage(room.gameType))); return; }
    }
    const r = await startRoom(roomId);
    if (!r.ok) { setNotice(translateServerMessage(r.error)); return; }
    preserveSocketRef.current = true;
    navigate(`/game/${roomId}`);
  };

  const onBack = async () => {
    const r = await leaveRoom(roomId);
    if (!r.ok) { setNotice(translateServerMessage(r.error)); return; }
    navigate("/lobby");
  };

  const generateQr = async () => {
    if (!room?.inviteCode) return;
    const url = `${window.location.origin}/join/${room.inviteCode}`;
    try { setQrDataUrl(await QRCode.toDataURL(url, { margin: 2, width: 280 })); setShowQr(true); }
    catch { /* ignore */ }
  };

  const icon = GAME_ICONS[room?.gameType ?? ""] ?? "🎮";

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">

      {/* Room info */}
      <Card className="animate-rise">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl border border-primary/20">
              {icon}
            </span>
            <div>
              <CardTitle>{room?.name ?? "Загрузка..."}</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {room ? gameTypeRu(room.gameType) : "—"} · {room ? roomStatusRu(room.status) : roomStatusRu("WAITING")}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Код приглашения</p>
              <p className="font-mono text-lg font-bold tracking-widest text-primary">
                {room?.inviteCode ?? "—"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Игроков</p>
              <p className="text-lg font-bold text-foreground">
                {room?.players.filter((p) => p.connected).length ?? 0} / {room?.maxPlayers ?? "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Players */}
      <Card className="animate-rise">
        <CardHeader><CardTitle>Игроки</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {(room?.players ?? []).map((p) => (
              <li key={p.userId} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full ${p.connected ? "bg-green-500" : "bg-red-500"}`} />
                  <div>
                    <div className="font-medium text-sm">
                      {p.username}
                      {room?.hostId === p.userId ? (
                        <span className="ml-2 text-xs text-primary font-normal">хост</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.connected ? "в сети" : "не в сети"}
                    </div>
                  </div>
                </div>
                <span className={`rounded-lg border px-2 py-0.5 text-xs font-semibold ${p.ready ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-border bg-muted text-muted-foreground"}`}>
                  {p.ready ? "Готов" : "Не готов"}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {notice ? <div className="notice-warn animate-rise">{notice}</div> : null}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 animate-rise">
        <Button onClick={() => void onReady()} variant={myReady ? "outline" : "default"}>
          {myReady ? "Отменить готовность" : "Я готов"}
        </Button>
        <Button variant="outline" onClick={() => void generateQr()}>
          QR-код
        </Button>
        <Button
          variant="secondary"
          onClick={() => void onStart()}
          disabled={!canStart || room?.status !== "WAITING"}
        >
          Начать игру
        </Button>
        <Button variant="ghost" onClick={() => void onBack()}>
          ← В лобби
        </Button>
      </div>

      {/* QR modal */}
      {showQr && qrDataUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowQr(false)}
        >
          <div
            className="animate-rise rounded-2xl border border-border bg-card p-6 text-center shadow-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={qrDataUrl} alt="Invite QR" className="mx-auto h-64 w-64 rounded-xl" />
            <p className="mt-3 font-mono text-xl font-bold tracking-widest text-primary">{room?.inviteCode}</p>
            <p className="mt-1 text-sm text-muted-foreground">Отсканируйте QR или поделитесь кодом</p>
            <Button variant="outline" className="mt-4" onClick={() => setShowQr(false)}>Закрыть</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
