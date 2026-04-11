import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CreateRoomBody, RoomListItem } from "@board-games/shared";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { resolveApiBaseUrl } from "../lib/apiBaseUrl";
import { gameTypeRu, roomStatusRu, translateServerMessage } from "../lib/i18n";
import { useAuthStore } from "../store/authStore";

const API_URL = resolveApiBaseUrl();

export default function LobbyPage(): React.JSX.Element {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<CreateRoomBody>({
    name: "",
    gameType: "chess",
    maxPlayers: 2,
    isPublic: true
  });

  const canCreate = useMemo(() => {
    if (form.name.trim().length < 3) return false;
    if (form.maxPlayers < 2 || form.maxPlayers > 4) return false;
    return true;
  }, [form]);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/rooms/public`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Не удалось загрузить комнаты.");
      }
      const data = (await response.json()) as RoomListItem[];
      setRooms(data);
      setNotice(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка.";
      setNotice(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRooms();
  }, []);

  const createRoom = async () => {
    if (!canCreate) return;
    const response = await fetch(`${API_URL}/api/rooms`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      const err = (await response.json()) as { message?: string };
      setNotice(translateServerMessage(err.message ?? "Failed to create room"));
      return;
    }

    const data = (await response.json()) as { id: string };
    setNotice(null);
    navigate(`/room/${data.id}`);
  };

  const joinByRoomId = async (roomId: string) => {
    const response = await fetch(`${API_URL}/api/rooms/${roomId}/join`, {
      method: "POST",
      credentials: "include"
    });

    if (!response.ok) {
      const err = (await response.json()) as { message?: string };
      setNotice(translateServerMessage(err.message ?? "Failed to join room"));
      return;
    }

    setNotice(null);
    navigate(`/room/${roomId}`);
  };

  const joinByCode = async () => {
    const response = await fetch(`${API_URL}/api/rooms/join-by-code`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteCode: inviteCode.trim().toUpperCase()
      })
    });

    if (!response.ok) {
      const err = (await response.json()) as { message?: string };
      setNotice(translateServerMessage(err.message ?? "Failed to join by invite code"));
      return;
    }

    const data = (await response.json()) as { roomId: string };
    setNotice(null);
    navigate(`/room/${data.roomId}`);
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="rounded-3xl border border-white/60 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Лобби настольных игр в реальном времени</h1>
            <p className="mt-2 text-cyan-100">Создавайте комнату, приглашайте друзей и начинайте матч с любого устройства.</p>
          </div>
          <div className="flex items-center gap-2">
            {user?.role === "admin" ? (
              <Button variant="outline" className="border-white/40 bg-white/10 text-white" onClick={() => navigate("/admin")}>
                Админ
              </Button>
            ) : null}
            <Button variant="outline" className="border-white/40 bg-white/10 text-white" onClick={() => void logout()}>
              Выйти
            </Button>
          </div>
        </div>
      </header>

      {notice ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{notice}</div>
      ) : null}

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Создать комнату</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Вечерняя партия"
            />

            <select
              className="h-11 rounded-xl border border-input bg-white/95 px-3 text-sm"
              value={form.gameType}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  gameType: e.target.value as "chess" | "checkers" | "durak",
                  maxPlayers: e.target.value === "durak" ? Math.max(prev.maxPlayers, 2) : 2
                }))
              }
            >
              <option value="chess">Шахматы</option>
              <option value="checkers">Шашки</option>
              <option value="durak">Дурак</option>
            </select>

            <Input
              type="number"
              min={2}
              max={4}
              value={form.maxPlayers}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  maxPlayers: Math.max(2, Math.min(4, Number(e.target.value)))
                }))
              }
            />

            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(e) => setForm((prev) => ({ ...prev, isPublic: e.target.checked }))}
              />
              Публичная комната
            </label>

            <Button disabled={!canCreate} onClick={() => void createRoom()}>
              Создать комнату
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Войти по коду приглашения</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              maxLength={6}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="AB12CD"
            />
            <Button disabled={inviteCode.trim().length !== 6} onClick={() => void joinByCode()}>
              Войти
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Публичные комнаты</CardTitle>
          <Button variant="outline" onClick={() => void fetchRooms()}>
            Обновить
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? <div className="text-sm text-slate-500">Загрузка комнат...</div> : null}

          {!loading && rooms.length === 0 ? (
            <div className="text-sm text-slate-500">Пока нет публичных комнат. Создайте первую.</div>
          ) : null}

          <ul className="space-y-2">
            {rooms.map((room) => (
              <li
                key={room.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-100 bg-white/80 px-3 py-3"
              >
                <div>
                  <div className="font-medium">{room.name}</div>
                  <div className="text-sm text-slate-600">
                    {gameTypeRu(room.gameType)} • {room.currentPlayers}/{room.maxPlayers} • {roomStatusRu(room.status)}
                  </div>
                </div>
                <Button
                  disabled={room.currentPlayers >= room.maxPlayers || room.status !== "WAITING"}
                  onClick={() => void joinByRoomId(room.id)}
                >
                  Войти
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
