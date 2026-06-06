import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  connectSocket, disconnectSocket, emitChatMessage, isTransientSocketIssue,
  joinRoom, leaveRoom, onChatMessage, onGameOver, onGameState, onPlayerDisconnected,
  onPlayerReconnected, onRoomJoined, onRoomUpdate, onSocketError, setReady, startRoom
} from "../socket/client";
import { useGameStore } from "../store/gameStore";
import { ChessGame }    from "../games/Chess";
import { CheckersGame } from "../games/Checkers";
import { DurakGame }    from "../games/Durak";
import { AliasGame }    from "../games/Alias";
import { MafiaGame }    from "../games/Mafia";
import { Button }       from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input }        from "../components/ui/input";
import { roomStatusRu, translateServerMessage } from "../lib/i18n";
import { gamePlayerCountMessage, validateGamePlayerCount } from "@board-games/shared";

export default function GamePage(): React.JSX.Element {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate   = useNavigate();

  const room           = useGameStore((s) => s.room);
  const gameState      = useGameStore((s) => s.gameState);
  const chat           = useGameStore((s) => s.chat);
  const connected      = useGameStore((s) => s.connected);
  const loading        = useGameStore((s) => s.loading);
  const setConnected   = useGameStore((s) => s.setConnected);
  const setLoading     = useGameStore((s) => s.setLoading);
  const setRoom        = useGameStore((s) => s.setRoom);
  const setPlayers     = useGameStore((s) => s.setPlayers);
  const setGameState   = useGameStore((s) => s.setGameState);
  const pushChatMessage= useGameStore((s) => s.pushChatMessage);
  const resetStore     = useGameStore((s) => s.reset);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatInput,        setChatInput]        = useState("");
  const [gameOverNotice,   setGameOverNotice]   = useState<string | null>(null);
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  const [actionNotice,     setActionNotice]     = useState<string | null>(null);
  const [sidebarOpen,      setSidebarOpen]      = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  useEffect(() => {
    if (!roomId) { navigate("/lobby"); return; }
    setLoading(true);
    const socket = connectSocket();

    const offJoined = onRoomJoined(({ room: r, selfId }) => {
      window.localStorage.setItem("user_id", selfId);
      setRoom(r); setLoading(false); setConnected(true);
    });

    const offUpdate = onRoomUpdate(({ roomId: rid, status, players }) => {
      if (rid !== roomId) return;
      setPlayers(rid, status as "WAITING" | "PLAYING" | "FINISHED", players);
    });

    const offState = onGameState(({ roomId: rid, state }) => {
      if (rid !== roomId) return;
      setGameState(state);
    });

    const offChat = onChatMessage((msg) => {
      if (msg.roomId !== roomId) return;
      pushChatMessage(msg);
    });

    const offOver = onGameOver((payload) => {
      if (payload.roomId !== roomId) return;
      const me = window.localStorage.getItem("user_id") ?? "";
      const msg = payload.reason === "player-left"
        ? payload.winnerId === me
          ? "Соперник вышел. Победа присуждена вам. Возврат в лобби..."
          : "Вы вышли из матча. Поражение. Возврат в лобби..."
        : `Игра завершена: ${translateServerMessage(payload.reason)}. Возврат в лобби...`;
      setGameOverNotice(msg);
      window.setTimeout(() => navigate("/lobby"), 2000);
    });

    const offDC = onPlayerDisconnected((p) => {
      if (p.roomId !== roomId) return;
      const name = useGameStore.getState().room?.players.find((pl) => pl.userId === p.userId)?.username ?? p.userId;
      setConnectionNotice(`${name} отключился. Ожидаем переподключения...`);
    });
    const offRC = onPlayerReconnected((p) => {
      if (p.roomId !== roomId) return;
      const name = useGameStore.getState().room?.players.find((pl) => pl.userId === p.userId)?.username ?? p.userId;
      setConnectionNotice(`${name} переподключился.`);
      window.setTimeout(() => setConnectionNotice(null), 3000);
    });
    const offErr = onSocketError((msg) => {
      setConnected(socket.connected);
      setConnectionNotice(msg);
    });

    const join = async () => {
      for (let i = 1; i <= 3; i++) {
        const r = await joinRoom({ roomId });
        if (r.ok) { setLoading(false); setConnectionNotice(null); return; }
        if (!isTransientSocketIssue(r.error)) { setLoading(false); setConnectionNotice(translateServerMessage(r.error)); navigate("/lobby"); return; }
        setConnectionNotice(`Переподключение... попытка ${i}/3`);
        await new Promise((res) => window.setTimeout(res, 500 * i));
      }
      setLoading(false);
      setConnectionNotice("Временная проблема сети.");
    };

    const onConnect    = () => { setConnected(true);  setConnectionNotice(null); void join(); };
    const onDisconnect = () => { setConnected(false); setConnectionNotice("Соединение потеряно. Переподключение..."); };
    socket.on("connect",    onConnect);
    socket.on("disconnect", onDisconnect);
    if (socket.connected) void join();

    return () => {
      socket.off("connect",    onConnect);
      socket.off("disconnect", onDisconnect);
      offJoined(); offUpdate(); offState(); offChat(); offOver(); offDC(); offRC(); offErr();
      disconnectSocket(); resetStore();
    };
  }, [roomId, navigate, setConnected, setGameState, setLoading, setPlayers, setRoom, pushChatMessage, resetStore]);

  if (!roomId) return <div className="p-6">Идентификатор комнаты не найден.</div>;

  const me      = window.localStorage.getItem("user_id") ?? "";
  const myReady = Boolean(room?.players.find((p) => p.userId === me)?.ready);
  const canStart= Boolean(room && room.hostId === me && room.players.filter((p) => p.connected).every((p) => p.ready));

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text) return;
    const r = await emitChatMessage({ roomId, text });
    if (!r.ok) { setActionNotice(translateServerMessage(r.error)); return; }
    setActionNotice(null); setChatInput("");
  };

  const toggleReady = async () => {
    const r = await setReady({ roomId, ready: !myReady });
    if (!r.ok) setActionNotice(translateServerMessage(r.error));
  };

  const onStart = async () => {
    if (room) {
      const conn = room.players.filter((p) => p.connected);
      const check = validateGamePlayerCount(room.gameType, conn.length);
      if (!check.ok) { setActionNotice(translateServerMessage(check.message ?? gamePlayerCountMessage(room.gameType))); return; }
    }
    const r = await startRoom(roomId);
    if (!r.ok) setActionNotice(translateServerMessage(r.error));
  };

  const onBack = async () => {
    const r = await leaveRoom(roomId);
    if (!r.ok) { setActionNotice(translateServerMessage(r.error)); return; }
    navigate("/lobby");
  };

  const renderGame = (): React.JSX.Element => {
    if (!room || !gameState) return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-8 text-muted-foreground">
        Загрузка игры...
      </div>
    );
    if (room.gameType === "chess")    return <ChessGame />;
    if (room.gameType === "checkers") return <CheckersGame />;
    if (room.gameType === "durak")    return <DurakGame />;
    if (room.gameType === "alias")    return <AliasGame />;
    return <MafiaGame />;
  };

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-6 sm:py-6">

      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-2 w-2 shrink-0 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
          <div className="min-w-0">
            <div className="truncate font-semibold text-foreground">{room?.name ?? "Загрузка..."}</div>
            <div className="text-xs text-muted-foreground">
              {roomStatusRu(room?.status ?? "WAITING")} · {room?.players.filter((p) => p.connected).length ?? 0}/{room?.maxPlayers ?? "—"} игроков
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={myReady ? "outline" : "default"} onClick={() => void toggleReady()}>
            {myReady ? "Не готов" : "Готов"}
          </Button>
          <Button size="sm" variant="secondary" disabled={!canStart || room?.status !== "WAITING"} onClick={() => void onStart()}>
            Начать
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void onBack()}>← Лобби</Button>
          {/* Mobile sidebar toggle */}
          <Button size="sm" variant="outline" className="lg:hidden" onClick={() => setSidebarOpen((v) => !v)}>
            {sidebarOpen ? "Скрыть" : "Чат / Игроки"}
          </Button>
        </div>
      </div>

      {/* Notices */}
      {gameOverNotice   ? <div className="notice-warn mb-3">{gameOverNotice}</div>   : null}
      {connectionNotice ? <div className="notice-warn mb-3">{connectionNotice}</div> : null}
      {actionNotice     ? <div className="notice-error mb-3">{actionNotice}</div>    : null}

      {/* Main layout */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

        {/* Game area */}
        <div className="min-w-0 flex-1">
          {loading
            ? <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12 text-muted-foreground">Подключение...</div>
            : renderGame()
          }
        </div>

        {/* Sidebar — always visible on lg, toggle on mobile */}
        <aside className={[
          "flex w-full flex-col gap-4 lg:w-[300px] lg:shrink-0 xl:w-[320px]",
          sidebarOpen ? "flex" : "hidden lg:flex"
        ].join(" ")}>

          {/* Players */}
          <Card>
            <CardHeader><CardTitle>Игроки</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(room?.players ?? []).map((p) => (
                  <li key={p.userId} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${p.connected ? "bg-green-500" : "bg-muted-foreground"}`} />
                      <span className="text-sm font-medium">
                        {p.username}
                        {room?.hostId === p.userId ? <span className="ml-1 text-xs text-primary">♛</span> : null}
                        {p.userId === me ? <span className="ml-1 text-xs text-muted-foreground">(вы)</span> : null}
                      </span>
                    </div>
                    <span className={`text-xs font-semibold ${p.ready ? "text-green-400" : "text-muted-foreground"}`}>
                      {p.ready ? "✓" : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Chat */}
          <Card className="flex flex-col">
            <CardHeader><CardTitle>Чат</CardTitle></CardHeader>
            <CardContent>
              <div className="h-52 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3 sm:h-60">
                {chat.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground pt-4">Пока нет сообщений</p>
                ) : (
                  chat.map((m) => (
                    <div key={m.id} className="text-sm">
                      <span className="font-semibold text-primary">{m.username}: </span>
                      <span className="text-foreground">{m.text}</span>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void sendChat(); }}
                  placeholder="Сообщение..."
                />
                <Button size="sm" onClick={() => void sendChat()}>→</Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
