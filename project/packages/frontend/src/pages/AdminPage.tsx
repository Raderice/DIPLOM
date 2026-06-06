import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { resolveApiBaseUrl } from "../lib/apiBaseUrl";
import { usePageTitle } from "../lib/usePageTitle";
import { gameTypeRu, roomStatusRu, translateServerMessage } from "../lib/i18n";
import { toast } from "../store/toastStore";

const API_URL = resolveApiBaseUrl();

interface AdminRoom {
  id: string;
  game: string;
  players: number;
  status: string;
  created_at: string;
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-3 w-16 rounded" />
          <div className="skeleton h-3 w-8 rounded" />
          <div className="skeleton h-3 w-16 rounded" />
          <div className="skeleton h-3 w-28 rounded" />
          <div className="skeleton h-8 w-36 rounded-xl ml-auto" />
        </div>
      ))}
    </div>
  );
}

export default function AdminPage(): React.JSX.Element {
  usePageTitle("Админ");
  const navigate  = useNavigate();
  const [rooms,   setRooms]   = useState<AdminRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const load = async () => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/rooms`, {
        credentials: "include",
        signal: ctrl.signal
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        toast.error(translateServerMessage(err.message ?? "Не удалось загрузить комнаты"));
        return;
      }
      setRooms((await res.json()) as AdminRoom[]);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error("Ошибка сети при загрузке комнат");
      }
    } finally {
      setLoading(false);
    }
  };

  const forceClose = async (roomId: string, roomGame: string) => {
    if (!window.confirm(`Принудительно закрыть комнату «${gameTypeRu(roomGame)}» (${roomId.slice(0, 8)}…)?`)) return;
    setClosing(roomId);
    try {
      const res = await fetch(`${API_URL}/api/admin/rooms/${roomId}/force-close`, {
        method: "POST",
        credentials: "include"
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        toast.error(translateServerMessage(err.message ?? "Не удалось закрыть комнату"));
        return;
      }
      toast.success("Комната закрыта");
      await load();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setClosing(null);
    }
  };

  useEffect(() => {
    void load();
    return () => ctrlRef.current?.abort();
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      <Card className="animate-rise">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Активные комнаты</CardTitle>
              {!loading && (
                <p className="text-xs text-muted-foreground mt-0.5">{rooms.length} комнат</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void load()} isLoading={loading}>
                {loading ? "Загрузка" : "↺ Обновить"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/lobby")}>
                ← Лобби
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton />
          ) : rooms.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-3xl mb-2">🏠</p>
              <p className="text-sm font-medium text-foreground">Нет активных комнат</p>
              <p className="text-xs text-muted-foreground mt-1">Все комнаты закрыты или ещё не созданы</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">ID</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Игра</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Игроки</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Статус</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Создана</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{room.id.slice(0, 8)}…</td>
                      <td className="px-3 py-3">{gameTypeRu(room.game)}</td>
                      <td className="px-3 py-3">{room.players}</td>
                      <td className="px-3 py-3">
                        <span className={[
                          "rounded-md border px-2 py-0.5 text-xs font-semibold",
                          room.status === "PLAYING"
                            ? "border-green-500/40 bg-green-500/10 text-green-400"
                            : room.status === "WAITING"
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-border bg-muted text-muted-foreground"
                        ].join(" ")}>
                          {roomStatusRu(room.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {new Date(room.created_at).toLocaleString("ru-RU")}
                      </td>
                      <td className="px-3 py-3">
                        <Button
                          variant="danger"
                          size="sm"
                          isLoading={closing === room.id}
                          onClick={() => void forceClose(room.id, room.game)}
                        >
                          Закрыть
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
