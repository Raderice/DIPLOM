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

  const [profile,      setProfile]      = useState<any | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [editing,      setEditing]      = useState(false);
  const [form,         setForm]         = useState({ username: "", bio: "", avatarUrl: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
  const [notice,       setNotice]       = useState<string | null>(null);
  const [history,      setHistory]      = useState<any[]>([]);
  const [opponents,    setOpponents]    = useState<any[]>([]);

  useEffect(() => {
    const id = userId ?? me?.id ?? null;
    if (!id) return;
    void fetchProfile(id);
    void fetchHistory(id);
    void fetchOpponents(id);
  }, [userId, me?.id]);

  const fetchProfile = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfile(data.user);
      setForm({ username: data.user.username ?? "", bio: data.user.bio ?? "", avatarUrl: data.user.avatarUrl ?? "" });
    } catch { setNotice("Не удалось загрузить профиль."); }
    finally  { setLoading(false); }
  };

  const fetchHistory   = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/users/${id}/history`, { credentials: "include" });
      if (res.ok) setHistory(((await res.json()) as { sessions: any[] }).sessions ?? []);
    } catch { /* ignore */ }
  };

  const fetchOpponents = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/users/${id}/opponents`, { credentials: "include" });
      if (res.ok) setOpponents(((await res.json()) as { opponents: any[] }).opponents ?? []);
    } catch { /* ignore */ }
  };

  const save = async () => {
    if (!profile) return;
    try {
      if (selectedFile) {
        const dataUrl = await new Promise<string | null>((resolve) => {
          const fr = new FileReader();
          fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : null);
          fr.onerror = () => resolve(null);
          fr.readAsDataURL(selectedFile);
        });
        if (!dataUrl) { setNotice("Не удалось прочитать файл."); return; }
        const r = await fetch(`${API_URL}/api/users/${profile.id}/avatar`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: dataUrl, filename: selectedFile.name })
        });
        if (!r.ok) { setNotice("Ошибка при загрузке аватара."); return; }
        const up = await r.json();
        setProfile(up.user);
        setForm((p) => ({ ...p, avatarUrl: up.user.avatarUrl ?? p.avatarUrl }));
        setSelectedFile(null); setPreviewUrl(null);
      }
      const res = await fetch(`${API_URL}/api/users/${profile.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!res.ok) { setNotice("Ошибка сохранения."); return; }
      setProfile((await res.json()).user);
      setEditing(false); setNotice(null);
    } catch { setNotice("Ошибка сети."); }
  };

  const createRematch = async (opponentId: string) => {
    if (!profile) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${profile.id}/rematch`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opponentId })
      });
      if (!res.ok) { setNotice("Не удалось создать реванш."); return; }
      window.location.href = `/room/${((await res.json()) as { roomId: string }).roomId}`;
    } catch { setNotice("Ошибка сети при создании реванша."); }
  };

  if (loading) return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
      Загрузка профиля...
    </div>
  );
  if (!profile) return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
      Профиль не найден.
    </div>
  );

  const isMe = me?.id === profile.id;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">

      {/* Profile card */}
      <Card className="animate-rise">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative">
                <img
                  src={previewUrl ?? profile.avatarUrl ?? "/logo-192.svg"}
                  alt="avatar"
                  className="h-24 w-24 rounded-2xl border border-border object-cover sm:h-28 sm:w-28"
                />
                {isMe && editing ? (
                  <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-xs hover:bg-muted">
                    ✏️
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setSelectedFile(f);
                        if (f) setPreviewUrl(URL.createObjectURL(f));
                      }}
                    />
                  </label>
                ) : null}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Имя пользователя</label>
                    <Input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">О себе</label>
                    <textarea
                      value={form.bio}
                      onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                      className="h-24 w-full rounded-xl border border-border bg-input p-3 text-sm outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => void save()}>Сохранить</Button>
                    <Button variant="outline" onClick={() => { setEditing(false); setPreviewUrl(null); }}>Отмена</Button>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="font-display text-2xl font-semibold text-foreground">{profile.username}</h2>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                  {profile.bio ? (
                    <p className="mt-3 text-sm text-foreground/80 whitespace-pre-wrap">{profile.bio}</p>
                  ) : (
                    <p className="mt-3 text-sm italic text-muted-foreground">Биография не указана</p>
                  )}
                  {isMe ? (
                    <Button className="mt-4" size="sm" onClick={() => setEditing(true)}>Редактировать профиль</Button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {notice ? <div className="notice-error">{notice}</div> : null}

      {/* Recent opponents */}
      <Card className="animate-rise">
        <CardHeader><CardTitle>Недавние соперники</CardTitle></CardHeader>
        <CardContent>
          {opponents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет данных</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {opponents.map((o) => (
                <div key={o.id} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 p-3 text-center card-hover">
                  <img
                    src={o.avatarUrl ?? "/logo-192.svg"}
                    alt={o.username}
                    className="h-12 w-12 rounded-xl border border-border object-cover"
                  />
                  <span className="text-sm font-medium truncate w-full">{o.username}</span>
                  {isMe ? (
                    <Button size="sm" variant="outline" className="w-full" onClick={() => void createRematch(o.id)}>
                      Реванш
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Match history */}
      <Card className="animate-rise">
        <CardHeader><CardTitle>История матчей</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет сыгранных матчей.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <div>
                    <div className="font-medium text-sm">{s.room?.name ?? s.room?.gameType ?? "Матч"}</div>
                    <div className="text-xs text-muted-foreground">{new Date(s.startedAt).toLocaleString("ru-RU")}</div>
                  </div>
                  <div className="text-sm text-right">
                    <span className="text-muted-foreground">Победитель: </span>
                    <span className={s.winner?.username ? "text-primary font-semibold" : "text-muted-foreground"}>
                      {s.winner?.username ?? "—"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
