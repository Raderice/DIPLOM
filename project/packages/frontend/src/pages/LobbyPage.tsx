import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CreateRoomBody, RoomListItem } from "@board-games/shared";
import { gamePlayerCountMessage, getGamePlayerLimits, validateGamePlayerCount } from "@board-games/shared";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { resolveApiBaseUrl } from "../lib/apiBaseUrl";
import { usePageTitle } from "../lib/usePageTitle";
import { gameTypeRu, roomStatusRu, translateServerMessage } from "../lib/i18n";
import { useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";

const API_URL = resolveApiBaseUrl();
const REFRESH_INTERVAL = 30;

type GameType = CreateRoomBody["gameType"];

const GAME_META: Record<GameType, { label: string; icon: string; badgeClass: string; desc: string }> = {
  chess:    { label: "Шахматы",  icon: "♟",  badgeClass: "badge-chess",    desc: "Классические шахматы с часами 10+0" },
  checkers: { label: "Шашки",    icon: "⬤",  badgeClass: "badge-checkers", desc: "Русские шашки с обязательным взятием" },
  durak:    { label: "Дурак",    icon: "♠",  badgeClass: "badge-durak",    desc: "Карточная игра 2–6 игроков" },
  alias:    { label: "Alias",    icon: "💬", badgeClass: "badge-alias",    desc: "Объясняй слова, не называя их" },
  mafia:    { label: "Мафия",    icon: "🎭", badgeClass: "badge-mafia",    desc: "Городская ролевая игра" }
};

function RoomSkeleton() {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
      <div className="flex items-center gap-3 flex-1">
        <div className="skeleton h-10 w-10 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3.5 w-32 rounded" />
          <div className="skeleton h-3 w-24 rounded" />
        </div>
      </div>
      <div className="skeleton h-8 w-16 rounded-lg" />
    </li>
  );
}

export default function LobbyPage(): React.JSX.Element {
  const navigate = useNavigate();
  const user     = useAuthStore((s) => s.user);
  const logout   = useAuthStore((s) => s.logout);

  const [rooms,      setRooms]      = useState<RoomListItem[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [everLoaded, setEverLoaded] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [countdown,  setCountdown]  = useState(REFRESH_INTERVAL);
  const [roomFilter, setRoomFilter] = useState<GameType | "all">("all");
  const [roomSearch, setRoomSearch] = useState("");
  const [form, setForm] = useState<CreateRoomBody>({
    name: "", gameType: "chess", maxPlayers: 2, isPublic: true
  });

  usePageTitle("Лобби");
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef= useRef<ReturnType<typeof setInterval> | null>(null);

  const canCreate   = useMemo(() => {
    if (form.name.trim().length < 3) return false;
    return validateGamePlayerCount(form.gameType, form.maxPlayers).ok;
  }, [form]);

  const playerLimits = useMemo(() => getGamePlayerLimits(form.gameType), [form.gameType]);

  const filteredRooms = useMemo(() => {
    let result = roomFilter === "all" ? rooms : rooms.filter((r) => r.gameType === roomFilter);
    const q = roomSearch.trim().toLowerCase();
    if (q) result = result.filter((r) => r.name.toLowerCase().includes(q));
    return result;
  }, [rooms, roomFilter, roomSearch]);

  const fetchRooms = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/rooms/public`, { credentials: "include" });
      if (!res.ok) throw new Error("Не удалось загрузить комнаты.");
      setRooms((await res.json()) as RoomListItem[]);
      setCountdown(REFRESH_INTERVAL);
      setEverLoaded(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Неизвестная ошибка.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const startAutoRefresh = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    timerRef.current = setInterval(() => void fetchRooms(true), REFRESH_INTERVAL * 1000);
    countdownRef.current = setInterval(() => setCountdown((c) => (c > 1 ? c - 1 : REFRESH_INTERVAL)), 1000);
  };

  useEffect(() => {
    void fetchRooms();
    startAutoRefresh();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const manualRefresh = () => {
    void fetchRooms();
    startAutoRefresh();
  };

  const createRoom = async () => {
    if (!canCreate) { toast.warn(translateServerMessage(gamePlayerCountMessage(form.gameType))); return; }
    try {
      const res = await fetch(`${API_URL}/api/rooms`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json() as { id?: string; message?: string };
      if (!res.ok) { toast.error(translateServerMessage(data.message ?? "Failed to create room")); return; }
      navigate(`/room/${data.id}`);
    } catch { toast.error("Ошибка сети при создании комнаты."); }
  };

  const joinByRoomId = async (roomId: string) => {
    const res = await fetch(`${API_URL}/api/rooms/${roomId}/join`, { method: "POST", credentials: "include" });
    if (!res.ok) { toast.error(translateServerMessage(((await res.json()) as { message?: string }).message ?? "Failed to join room")); return; }
    navigate(`/room/${roomId}`);
  };

  const joinByCode = async () => {
    const res = await fetch(`${API_URL}/api/rooms/join-by-code`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() })
    });
    if (!res.ok) { toast.error(translateServerMessage(((await res.json()) as { message?: string }).message ?? "Failed to join")); return; }
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
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(74,222,128,0.6)]" />
              {`${rooms.reduce((s, r) => s + r.currentPlayers, 0)} в комнатах`}
            </span>
          </div>
        </div>
      </div>

      {/* Game type showcase */}
      <div className="animate-rise">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Доступные игры</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {(Object.entries(GAME_META) as [GameType, typeof GAME_META[GameType]][]).map(([type, m]) => {
            const activePlayers = rooms
              .filter((r) => r.gameType === type)
              .reduce((s, r) => s + r.currentPlayers, 0);
            return (
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
                {activePlayers > 0 && (
                  <span className="text-[10px] tabular-nums text-muted-foreground leading-none">
                    {activePlayers} онлайн
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

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
            <div className="space-y-1.5">
              <label htmlFor="room-name" className="text-sm font-medium text-foreground/80">Название комнаты</label>
              <Input
                id="room-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Например: Партия с друзьями"
                onKeyDown={(e) => { if (e.key === "Enter" && canCreate) void createRoom(); }}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="room-game" className="text-sm font-medium text-foreground/80">Тип игры</label>
              <div className="relative">
                <select
                  id="room-game"
                  className="h-11 w-full appearance-none rounded-xl border border-border bg-input pl-4 pr-10 text-sm text-foreground outline-none transition-all duration-150 hover:border-border/80 focus:border-primary/70 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0"
                  value={form.gameType}
                  onChange={(e) => setForm((p) => ({
                    ...p,
                    gameType: e.target.value as GameType,
                    maxPlayers: getGamePlayerLimits(e.target.value as GameType).min
                  }))}
                >
                  {(Object.entries(GAME_META) as [GameType, typeof GAME_META[GameType]][]).map(([type, m]) => (
                    <option key={type} value={type}>{m.label}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">▾</span>
              </div>
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <label htmlFor="room-players" className="text-sm font-medium text-foreground/80">
                  Игроков ({playerLimits.min}–{playerLimits.max})
                </label>
                <Input
                  id="room-players"
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
              <label htmlFor="room-public" className="flex cursor-pointer items-center gap-2 pb-2.5 text-sm text-muted-foreground select-none">
                <input
                  id="room-public"
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
              id="invite-code"
              maxLength={6}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="AB12CD"
              className="text-center font-mono text-lg tracking-[0.3em] uppercase"
              onKeyDown={(e) => { if (e.key === "Enter" && inviteCode.trim().length === 6) void joinByCode(); }}
              aria-label="Код приглашения"
              autoComplete="off"
              inputMode="text"
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Публичные комнаты</CardTitle>
              {rooms.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {filteredRooms.length} {roomFilter === "all" ? "всего" : "по фильтру"}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={manualRefresh} isLoading={loading}>
                {loading ? "Загрузка" : "↺ Обновить"}
              </Button>
            </div>
          </div>

          {/* Refresh progress bar */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/60 transition-[width] duration-1000 ease-linear"
                style={{ width: `${((REFRESH_INTERVAL - countdown) / REFRESH_INTERVAL) * 100}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground w-8 text-right shrink-0">
              {countdown}с
            </span>
          </div>

          {/* Search */}
          <div className="mt-3 relative">
            <input
              type="text"
              value={roomSearch}
              onChange={(e) => setRoomSearch(e.target.value)}
              placeholder="Поиск по названию..."
              className="h-9 w-full rounded-xl border border-border bg-input pl-3 pr-8 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 hover:border-border/80 focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
            />
            {roomSearch && (
              <button
                onClick={() => setRoomSearch("")}
                aria-label="Очистить поиск"
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-border transition-colors text-xs"
              >
                ×
              </button>
            )}
          </div>

          {/* Game type filter */}
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Фильтр по типу игры">
            <button
              onClick={() => setRoomFilter("all")}
              className={[
                "min-h-[36px] rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                roomFilter === "all"
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-muted/40 text-muted-foreground hover:border-border/70 hover:text-foreground"
              ].join(" ")}
              aria-pressed={roomFilter === "all"}
            >
              Все
            </button>
            {(Object.entries(GAME_META) as [GameType, typeof GAME_META[GameType]][]).map(([type, m]) => (
              <button
                key={type}
                onClick={() => setRoomFilter(type)}
                className={[
                  "min-h-[36px] rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  roomFilter === type
                    ? `${m.badgeClass} ring-1 ring-current`
                    : "border-border bg-muted/40 text-muted-foreground hover:border-border/70 hover:text-foreground"
                ].join(" ")}
                aria-pressed={roomFilter === type}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading && !everLoaded ? (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <RoomSkeleton key={i} />)}
            </ul>
          ) : filteredRooms.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-4xl mb-3">🎲</p>
              <p className="text-sm font-medium text-foreground">
                {roomSearch.trim()
                  ? `Ничего не найдено по «${roomSearch.trim()}»`
                  : roomFilter === "all"
                    ? "Нет публичных комнат"
                    : `Нет комнат «${GAME_META[roomFilter as GameType]?.label}»`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {roomSearch.trim()
                  ? "Попробуйте другой запрос"
                  : roomFilter === "all"
                    ? "Создайте первую!"
                    : "Измените фильтр или создайте комнату"}
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredRooms.map((room) => {
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
