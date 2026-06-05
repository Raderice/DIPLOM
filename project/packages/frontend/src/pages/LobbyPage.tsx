import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CreateRoomBody, RoomListItem } from "@board-games/shared";
import { gamePlayerCountMessage, getGamePlayerLimits, validateGamePlayerCount } from "@board-games/shared";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { resolveApiBaseUrl } from "../lib/apiBaseUrl";
import { gameTypeRu, roomStatusRu, translateServerMessage } from "../lib/i18n";
import { useAuthStore } from "../store/authStore";

const API_URL = resolveApiBaseUrl();

type GameType = CreateRoomBody["gameType"];

const GAME_META: Record<GameType, { label: string; icon: string; badgeClass: string; desc: string }> = {
  chess:    { label: "Шахматы",  icon: "♟",  badgeClass: "badge-chess",    desc: "Классические шахматы с часами 10+0" },
  checkers: { label: "Шашки",    icon: "⬤",  badgeClass: "badge-checkers", desc: "Русские шашки с обязательным взятием" },
  durak:    { label: "Дурак",    icon: "♠",  badgeClass: "badge-durak",    desc: "Карточная игра 2–6 игроков" },
  alias:    { label: "Alias",    icon: "💬", badgeClass: "badge-alias",    desc: "Объясняй слова, не называя их" },
  mafia:    { label: "Мафия",    icon: "🎭", badgeClass: "badge-mafia",    desc: "Городская ролевая игра" }
};

export default function LobbyPage(): React.JSX.Element {
  const navigate = useNavigate();
  const user     = useAuthStore((s) => s.user);
  const logout   = useAuthStore((s) => s.logout);

  const [rooms,       setRooms]       = useState<RoomListItem[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [inviteCode,  setInviteCode]  = useState("");
  const [notice,      setNotice]      = useState<string | null>(null);
  const [form, setForm] = useState<CreateRoomBody>({
    name: "", gameType: "chess", maxPlayers: 2, isPublic: true
  });

  const canCreate   = useMemo(() => {
    if (form.name.trim().length < 3) return false;
    return validateGamePlayerCount(form.gameType, form.maxPlayers).ok;
  }, [form]);

  const playerLimits = useMemo(() => getGamePlayerLimits(form.gameType), [form.gameType]);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/rooms/public`, { credentials: "include" });
      if (!res.ok) throw new Error("Не удалось загрузить комнаты.");
      setRooms((await res.json()) as RoomListItem[]);
      setNotice(null);
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : "Неизвестная ошибка.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchRooms(); }, []);

  const createRoom = async () => {
    if (!canCreate) { setNotice(translateServerMessage(gamePlayerCountMessage(form.gameType))); return; }
    try {
      const res = await fetch(`${API_URL}/api/rooms`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!res.ok) { setNotice(translateServerMessage(((await res.json()) as { message?: string }).message ?? "Failed to create room")); return; }
      navigate(`/room/${((await res.json()) as { id: string }).id}`);
    } catch { setNotice("Ошибка сети при создании комнаты."); }
  };

  const joinByRoomId = async (roomId: string) => {
    const res = await fetch(`${API_URL}/api/rooms/${roomId}/join`, { method: "POST", credentials: "include" });
    if (!res.ok) { setNotice(translateServerMessage(((await res.json()) as { message?: string }).message ?? "Failed to join room")); return; }
    navigate(`/room/${roomId}`);
  };

  const joinByCode = async () => {
    const res = await fetch(`${API_URL}/api/rooms/join-by-code`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() })
    });
    if (!res.ok) { setNotice(translateServerMessage(((await res.json()) as { message?: string }).message ?? "Failed to join")); return; }
    navigate(`/room/${((await res.json()) as { roomId: string }).roomId}`);
  };

  const meta = GAME_META[form.gameType];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">

      {/* Page header */}
      <div className="animate-fade">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-5 shadow-panel sm:px-6 sm:py-6">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Board Games Arena
            </p>
            <h1 className="font-display text-2xl font-semibold tracking-wide text-foreground sm:text-3xl">
              Лобби
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Добро пожаловать, <span className="text-foreground font-medium">{user?.username}</span>
            </p>
          </div>
          <div className="flex gap-2">
            {user?.role === "admin" ? (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>Админ</Button>
            ) : null}
            <Button variant="ghost" size="sm" asChild>
              <a href="/profile">Профиль</a>
            </Button>
          </div>
        </div>
      </div>

      {/* Game type showcase */}
      <div className="animate-rise">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Доступные игры</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {(Object.entries(GAME_META) as [GameType, typeof GAME_META[GameType]][]).map(([type, m]) => (
            <button
              key={type}
              onClick={() => setForm((p) => ({ ...p, gameType: type, maxPlayers: getGamePlayerLimits(type).min }))}
              className={[
                "flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-center transition-all duration-150 cursor-pointer",
                "hover:shadow-glow-sm active:scale-[0.97]",
                form.gameType === type
                  ? `${m.badgeClass} ring-1 ring-current`
                  : "border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground"
              ].join(" ")}
            >
              <span className="text-2xl leading-none">{m.icon}</span>
              <span className="text-xs font-semibold">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {notice ? <div className="notice-warn animate-rise">{notice}</div> : null}

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">

        {/* Create room */}
        <Card className="animate-rise">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg ${meta.badgeClass}`}>
                {meta.icon}
              </span>
              <div>
                <CardTitle>Создать комнату</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{meta.desc}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Название комнаты"
            />

            <select
              className="h-11 w-full rounded-xl border border-border bg-input px-4 text-sm text-foreground outline-none transition focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
              value={form.gameType}
              onChange={(e) => setForm((p) => ({
                ...p,
                gameType: e.target.value as GameType,
                maxPlayers: getGamePlayerLimits(e.target.value as GameType).min
              }))}
            >
              {(Object.entries(GAME_META) as [GameType, typeof GAME_META[GameType]][]).map(([type, m]) => (
                <option key={type} value={type}>{m.icon} {m.label}</option>
              ))}
            </select>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">
                  Игроков ({playerLimits.min}–{playerLimits.max})
                </label>
                <Input
                  type="number"
                  min={playerLimits.min}
                  max={playerLimits.max}
                  value={form.maxPlayers}
                  onChange={(e) => setForm((p) => ({
                    ...p,
                    maxPlayers: Math.max(playerLimits.min, Math.min(playerLimits.max, Number(e.target.value)))
                  }))}
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 pt-5 text-sm text-muted-foreground select-none">
                <input
                  type="checkbox"
                  checked={form.isPublic}
                  onChange={(e) => setForm((p) => ({ ...p, isPublic: e.target.checked }))}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                Публичная
              </label>
            </div>

            <Button disabled={!canCreate} onClick={() => void createRoom()} className="w-full">
              Создать комнату
            </Button>
          </CardContent>
        </Card>

        {/* Join by code */}
        <Card className="animate-rise">
          <CardHeader>
            <CardTitle>Войти по коду</CardTitle>
            <p className="text-sm text-muted-foreground">Введите 6-значный код приглашения</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              maxLength={6}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="AB12CD"
              className="text-center font-mono text-lg tracking-[0.3em] uppercase"
            />
            <Button
              disabled={inviteCode.trim().length !== 6}
              onClick={() => void joinByCode()}
              className="w-full"
            >
              Войти в комнату
            </Button>

            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Как получить код?</p>
              <p className="text-sm text-muted-foreground">Попросите хоста показать QR-код или скопировать код из страницы комнаты.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Public rooms */}
      <Card className="animate-rise">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Публичные комнаты</CardTitle>
            <Button variant="outline" size="sm" onClick={() => void fetchRooms()} disabled={loading}>
              {loading ? "..." : "↺ Обновить"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Загрузка...</div>
          ) : rooms.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-3xl mb-2">🎲</p>
              <p className="text-sm text-muted-foreground">Нет публичных комнат. Создайте первую!</p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rooms.map((room) => {
                const m = GAME_META[room.gameType as GameType] ?? { icon: "?", label: room.gameType, badgeClass: "" };
                const full    = room.currentPlayers >= room.maxPlayers;
                const waiting = room.status === "WAITING";
                return (
                  <li key={room.id} className="card-hover flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-base ${m.badgeClass}`}>
                        {m.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-foreground text-sm">{room.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {gameTypeRu(room.gameType)} · {room.currentPlayers}/{room.maxPlayers} · {roomStatusRu(room.status)}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={!full && waiting ? "default" : "ghost"}
                      disabled={full || !waiting}
                      onClick={() => void joinByRoomId(room.id)}
                    >
                      {full ? "Полная" : !waiting ? "Идёт" : "Войти"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
