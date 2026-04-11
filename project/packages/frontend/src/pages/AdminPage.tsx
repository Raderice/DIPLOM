import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { resolveApiBaseUrl } from "../lib/apiBaseUrl";
import { gameTypeRu, roomStatusRu, translateServerMessage } from "../lib/i18n";

const API_URL = resolveApiBaseUrl();

interface AdminRoom {
  id: string;
  game: string;
  players: number;
  status: string;
  created_at: string;
}

export default function AdminPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/rooms`, {
        credentials: "include"
      });
      if (!response.ok) {
        const err = (await response.json()) as { message?: string };
        window.alert(translateServerMessage(err.message ?? "Failed to load admin rooms"));
        return;
      }
      const data = (await response.json()) as AdminRoom[];
      setRooms(data);
    } finally {
      setLoading(false);
    }
  };

  const forceClose = async (roomId: string) => {
    const response = await fetch(`${API_URL}/api/admin/rooms/${roomId}/force-close`, {
      method: "POST",
      credentials: "include"
    });

    if (!response.ok) {
      const err = (await response.json()) as { message?: string };
      window.alert(translateServerMessage(err.message ?? "Failed to close room"));
      return;
    }

    await load();
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Админ: активные комнаты</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load()}>
              Обновить
            </Button>
            <Button variant="outline" onClick={() => navigate("/lobby")}>Лобби</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-slate-500">Загрузка...</p> : null}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">ID</th>
                  <th className="p-2">Игра</th>
                  <th className="p-2">Игроки</th>
                  <th className="p-2">Статус</th>
                  <th className="p-2">Создана</th>
                  <th className="p-2">Действия</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id} className="border-b">
                    <td className="p-2 font-mono text-xs">{room.id}</td>
                    <td className="p-2">{gameTypeRu(room.game)}</td>
                    <td className="p-2">{room.players}</td>
                    <td className="p-2">{roomStatusRu(room.status)}</td>
                    <td className="p-2">{new Date(room.created_at).toLocaleString()}</td>
                    <td className="p-2">
                      <Button variant="danger" onClick={() => void forceClose(room.id)}>
                        Принудительно закрыть
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
