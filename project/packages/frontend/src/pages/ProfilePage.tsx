import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { resolveApiBaseUrl } from "../lib/apiBaseUrl";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

const API_URL = resolveApiBaseUrl();

export default function ProfilePage(): React.JSX.Element {
  const { userId } = useParams<{ userId: string }>();
  const me = useAuthStore((s) => s.user);

  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ username: "", bio: "", avatarUrl: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [opponents, setOpponents] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;
    void fetchProfile(userId);
    void fetchHistory(userId);
    void fetchOpponents(userId);
  }, [userId]);

  const fetchProfile = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch profile");
      const data = await res.json();
      setProfile(data.user);
      setForm({ username: data.user.username ?? "", bio: data.user.bio ?? "", avatarUrl: data.user.avatarUrl ?? "" });
    } catch (err) {
      setNotice("Не удалось загрузить профиль.");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/users/${id}/history`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setHistory(data.sessions ?? []);
    } catch {}
  };

  const fetchOpponents = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/users/${id}/opponents`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setOpponents(data.opponents ?? []);
    } catch {}
  };

  const save = async () => {
    if (!profile) return;
    try {
      // If user selected a new avatar file, upload it first (as base64 JSON)
      if (selectedFile) {
        const dataUrl = await new Promise<string | null>((resolve) => {
          const fr = new FileReader();
          fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : null);
          fr.onerror = () => resolve(null);
          fr.readAsDataURL(selectedFile);
        });
        if (!dataUrl) {
          setNotice("Не удалось прочитать файл.");
          return;
        }

        const r = await fetch(`${API_URL}/api/users/${profile.id}/avatar`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: dataUrl, filename: selectedFile.name })
        });
        if (!r.ok) {
          setNotice("Ошибка при загрузке аватара.");
          return;
        }
        const uploaded = await r.json();
        setProfile(uploaded.user);
        setForm((p) => ({ ...p, avatarUrl: uploaded.user.avatarUrl ?? p.avatarUrl }));
        setSelectedFile(null);
        setPreviewUrl(null);
      }
      const res = await fetch(`${API_URL}/api/users/${profile.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        setNotice("Ошибка сохранения профиля.");
        return;
      }
      const data = await res.json();
      setProfile(data.user);
      setEditing(false);
      setNotice(null);
    } catch {
      setNotice("Ошибка сети.");
    }
  };

  const createRematch = async (opponentId: string) => {
    if (!profile) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${profile.id}/rematch`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opponentId })
      });
      if (!res.ok) {
        setNotice("Не удалось создать реванш.");
        return;
      }
      const data = await res.json();
      // navigate to room
      window.location.href = `/room/${data.roomId}`;
    } catch {
      setNotice("Ошибка сети при создании реванша.");
    }
  };

  if (loading) return <div className="p-6">Загрузка профиля...</div>;
  if (!profile) return <div className="p-6">Профиль не найден.</div>;

  const isMe = me?.id === profile.id;

  return (
    <main className="mx-auto max-w-4xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>Профиль</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <img src={profile.avatarUrl ?? "/default-avatar.png"} alt="avatar" className="h-20 w-20 rounded-full object-cover" />
              <div>
                <div className="text-lg font-semibold">{profile.username}</div>
                <div className="text-sm text-muted-foreground">{profile.email}</div>
              </div>
            </div>

            {editing ? (
              <div className="grid gap-3">
                <Input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
                <div>
                  <label className="text-sm">Аватар</label>
                  <div className="mt-2 flex items-center gap-3">
                    <img src={previewUrl ?? form.avatarUrl ?? "/default-avatar.png"} alt="preview" className="h-16 w-16 rounded-full object-cover" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setSelectedFile(f);
                        if (f) setPreviewUrl(URL.createObjectURL(f));
                      }}
                    />
                  </div>
                </div>
                <textarea value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} className="h-24 rounded-xl border border-input bg-input p-2 text-sm" />
                <div className="flex gap-2">
                  <Button onClick={() => void save()}>Сохранить</Button>
                  <Button variant="outline" onClick={() => setEditing(false)}>Отмена</Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="whitespace-pre-wrap">{profile.bio ?? "Пока ничего не указано."}</p>
                <div className="mt-4 flex gap-2">
                  {isMe ? <Button onClick={() => setEditing(true)}>Редактировать</Button> : null}
                </div>
              </div>
            )}

            <section className="mt-6">
              <h3 className="text-lg font-semibold">Недавние соперники</h3>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                {opponents.length === 0 ? <div className="text-sm text-muted-foreground">Нет данных</div> : opponents.map((o) => (
                  <div key={o.id} className="flex items-center gap-2 rounded-xl border p-2">
                    <img src={o.avatarUrl ?? "/default-avatar.png"} alt="a" className="h-10 w-10 rounded-full object-cover" />
                    <div className="flex-1 text-sm">{o.username}</div>
                    {me?.id && me.id === profile.id ? (
                      <Button onClick={() => void createRematch(o.id)}>Реванш</Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-6">
              <h3 className="text-lg font-semibold">История матчей</h3>
              <div className="mt-2 space-y-2">
                {history.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Нет сыгранных матчей.</div>
                ) : (
                  history.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl border p-3">
                      <div>
                        <div className="font-medium">{s.room?.name ?? s.room?.gameType}</div>
                        <div className="text-sm text-muted-foreground">{new Date(s.startedAt).toLocaleString()}</div>
                      </div>
                      <div className="text-sm">Победитель: {s.winner?.username ?? "—"}</div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {notice ? <div className="text-sm text-red-400">{notice}</div> : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
