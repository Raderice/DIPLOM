import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { resolveApiBaseUrl } from "../lib/apiBaseUrl";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

const API_URL = resolveApiBaseUrl();

const GAME_META: Record<string, { icon: string; label: string; badgeClass: string }> = {
  chess:    { icon: "♟",  label: "Шахматы",  badgeClass: "badge-chess" },
  checkers: { icon: "⬤",  label: "Шашки",    badgeClass: "badge-checkers" },
  durak:    { icon: "♠",  label: "Дурак",    badgeClass: "badge-durak" },
  alias:    { icon: "💬", label: "Alias",    badgeClass: "badge-alias" },
  mafia:    { icon: "🎭", label: "Мафия",    badgeClass: "badge-mafia" },
};

function AvatarFallback({ username, size = "md" }: { username: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-24 w-24 sm:h-28 sm:w-28 text-2xl rounded-2xl" : size === "sm" ? "h-12 w-12 text-base rounded-xl" : "h-8 w-8 text-sm rounded-lg";
  return (
    <div className={`${sizeClass} bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0`}>
      <span className="font-bold text-primary">{username[0]?.toUpperCase()}</span>
    </div>
  );
}

function OpponentAvatar({ username, avatarUrl }: { username: string; avatarUrl?: string | null }) {
  const [err, setErr] = useState(false);
  if (!avatarUrl || err) return <AvatarFallback username={username} size="sm" />;
  return (
    <img
      src={avatarUrl}
      alt={username}
      className="h-12 w-12 rounded-xl border border-border object-cover"
      onError={() => setErr(true)}
    />
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="skeleton h-24 w-24 rounded-2xl sm:h-28 sm:w-28 shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="skeleton h-7 w-40 rounded" />
              <div className="skeleton h-4 w-56 rounded" />
              <div className="skeleton h-4 w-48 rounded" />
              <div className="skeleton h-9 w-36 rounded-xl mt-2" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><div className="skeleton h-5 w-28 rounded" /></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-center space-y-2">
                <div className="skeleton h-7 w-12 rounded mx-auto" />
                <div className="skeleton h-3 w-14 rounded mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileStats({ history, profileId }: { history: any[]; profileId: string }) {
  const wins    = history.filter((s) => s.winner?.id === profileId).length;
  const losses  = history.filter((s) => s.winner && s.winner.id !== profileId).length;
  const draws   = history.length - wins - losses;
  const winRate = history.length > 0 ? Math.round((wins / history.length) * 100) : 0;

  const byGame = Object.entries(
    history.reduce<Record<string, { w: number; l: number; d: number }>>((acc, s) => {
      const gt = s.room?.gameType ?? "unknown";
      if (!acc[gt]) acc[gt] = { w: 0, l: 0, d: 0 };
      if (s.winner?.id === profileId) acc[gt].w++;
      else if (s.winner) acc[gt].l++;
      else acc[gt].d++;
      return acc;
    }, {})
  ).sort((a, b) => (b[1].w + b[1].l + b[1].d) - (a[1].w + a[1].l + a[1].d));

  return (
    <Card className="animate-rise">
      <CardHeader><CardTitle>Статистика</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Игр",       value: history.length, color: "text-foreground" },
            { label: "Побед",     value: wins,           color: "text-green-500" },
            { label: "Поражений", value: losses,         color: "text-red-400" },
            { label: "Винрейт",   value: `${winRate}%`,  color: "text-primary" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-center">
              <div className={`text-2xl font-bold font-display ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {history.length >= 3 && (
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span className="text-green-500">Побед {wins}</span>
              {draws > 0 && <span>Ничьих {draws}</span>}
              <span className="text-red-400">Поражений {losses}</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-border">
              {wins   > 0 && <div className="bg-green-500 transition-all duration-700"         style={{ width: `${(wins   / history.length) * 100}%` }} />}
              {draws  > 0 && <div className="bg-muted-foreground/50 transition-all duration-700" style={{ width: `${(draws  / history.length) * 100}%` }} />}
              {losses > 0 && <div className="bg-red-400 transition-all duration-700"           style={{ width: `${(losses / history.length) * 100}%` }} />}
            </div>
          </div>
        )}

        {byGame.length > 1 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">По играм</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {byGame.map(([gt, stat]) => {
                const m = GAME_META[gt];
                const total = stat.w + stat.l + stat.d;
                return (
                  <div key={gt} className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm ${m?.badgeClass ?? ""}`}>
                      {m?.icon ?? "🎮"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-foreground truncate">{m?.label ?? gt}</div>
                      <div className="text-xs text-muted-foreground">{total} игр</div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-green-500">{stat.w}П</span>
                      <span className="text-xs text-muted-foreground mx-1">/</span>
                      <span className="text-xs font-semibold text-red-400">{stat.l}П</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProfilePage(): React.JSX.Element {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
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
  const [avatarErr,    setAvatarErr]    = useState(false);

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
      setAvatarErr(false);
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
        setAvatarErr(false);
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
      navigate(`/room/${((await res.json()) as { roomId: string }).roomId}`);
    } catch { setNotice("Ошибка сети при создании реванша."); }
  };

  if (loading) return <ProfileSkeleton />;

  if (!profile) return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
      Профиль не найден.
    </div>
  );

  const isMe = me?.id === profile.id;
  const avatarSrc = previewUrl ?? profile.avatarUrl;
  const showImg = !!avatarSrc && !avatarErr;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">

      {/* Profile card */}
      <Card className="animate-rise">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative">
                {showImg ? (
                  <img
                    src={avatarSrc}
                    alt="avatar"
                    className="h-24 w-24 rounded-2xl border border-border object-cover sm:h-28 sm:w-28"
                    onError={() => setAvatarErr(true)}
                  />
                ) : (
                  <AvatarFallback username={profile.username} size="lg" />
                )}
                {isMe && editing ? (
                  <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-xs hover:bg-muted transition-colors">
                    ✏️
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setSelectedFile(f);
                        if (f) { setPreviewUrl(URL.createObjectURL(f)); setAvatarErr(false); }
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
                  <div className="space-y-1.5">
                    <label htmlFor="profile-username" className="text-sm font-medium text-foreground/80">Имя пользователя</label>
                    <Input id="profile-username" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="profile-bio" className="text-sm font-medium text-foreground/80">О себе</label>
                    <textarea
                      id="profile-bio"
                      value={form.bio}
                      onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                      rows={3}
                      className="w-full resize-y rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground outline-none transition-all duration-150 placeholder:text-muted-foreground/60 hover:border-border/80 focus:border-primary/70 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0"
                      placeholder="Расскажите о себе..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => void save()}>Сохранить</Button>
                    <Button variant="outline" onClick={() => { setEditing(false); setPreviewUrl(null); setAvatarErr(false); }}>Отмена</Button>
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

      {/* Stats */}
      {history.length > 0 && <ProfileStats history={history} profileId={profile.id} />}

      {/* Recent opponents */}
      <Card className="animate-rise">
        <CardHeader><CardTitle>Недавние соперники</CardTitle></CardHeader>
        <CardContent>
          {opponents.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-3xl mb-2">🤝</p>
              <p className="text-sm font-medium text-foreground">Соперников пока нет</p>
              <p className="text-xs text-muted-foreground mt-1">Сыграйте хоть одну партию, чтобы здесь появились игроки</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {opponents.map((o) => (
                <div key={o.id} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 p-3 text-center card-hover">
                  <OpponentAvatar username={o.username} avatarUrl={o.avatarUrl} />
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
            <div className="py-8 text-center">
              <p className="text-3xl mb-2">🎲</p>
              <p className="text-sm font-medium text-foreground">История матчей пуста</p>
              <p className="text-xs text-muted-foreground mt-1">Завершите игру, чтобы она появилась здесь</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {history.map((s) => {
                const gt = s.room?.gameType ?? "";
                const m = GAME_META[gt];
                const isWin  = s.winner?.id === profile.id;
                const isLoss = s.winner && s.winner.id !== profile.id;
                const resultLabel = isWin ? "Победа" : isLoss ? "Поражение" : "Ничья";
                const resultClass = isWin
                  ? "border-green-500/40 bg-green-500/10 text-green-400"
                  : isLoss
                    ? "border-red-400/40 bg-red-400/10 text-red-400"
                    : "border-border bg-muted/40 text-muted-foreground";

                return (
                  <li key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                    {m && (
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm ${m.badgeClass}`}>
                        {m.icon}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{s.room?.name ?? m?.label ?? "Матч"}</div>
                      <div className="text-xs text-muted-foreground">{new Date(s.startedAt).toLocaleString("ru-RU")}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${resultClass}`}>
                        {resultLabel}
                      </span>
                      {s.winner?.username && (
                        <span className="text-xs text-muted-foreground">
                          {isWin ? "" : <span className="text-primary font-medium">{s.winner.username}</span>}
                        </span>
                      )}
                    </div>
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
