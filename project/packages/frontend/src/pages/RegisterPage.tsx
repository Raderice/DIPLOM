import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export default function RegisterPage(): React.JSX.Element {
  const navigate   = useNavigate();
  const register   = useAuthStore((s) => s.register);
  const loading    = useAuthStore((s) => s.loading);
  const error      = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [username, setUsername] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");

  const passwordWeak = password.length > 0 && password.length < 8;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const ok = await register(username, email, password);
    if (ok) navigate("/lobby");
  };

  return (
    <div className="flex min-h-[calc(100dvh-64px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-5xl">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">

          {/* Hero */}
          <div className="animate-fade space-y-6 text-center lg:text-left">
            <div>
              <p className="mb-3 inline-block rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Создайте профиль
              </p>
              <h1 className="font-display text-3xl font-semibold leading-snug text-foreground sm:text-4xl">
                Начните играть<br className="hidden sm:block" /> с друзьями онлайн
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground max-w-[52ch] mx-auto lg:mx-0">
                Регистрация занимает меньше минуты. После входа создавайте комнаты, приглашайте друзей по коду или QR и запускайте игры мгновенно.
              </p>
            </div>

            <ul className="space-y-2 text-sm max-w-md mx-auto lg:mx-0" aria-label="Преимущества платформы">
              {[
                "Безопасная авторизация на cookie-сессиях",
                "Игры с компьютера и телефона",
                "Приглашение по коду и QR-коду",
                "История матчей и профиль игрока"
              ].map((feat) => (
                <li key={feat} className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-2.5">
                  <span className="text-primary" aria-hidden="true">✓</span>
                  <span className="text-muted-foreground">{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Form */}
          <div className="animate-rise rounded-2xl border border-border bg-card p-6 shadow-panel sm:p-8">
            <div className="mb-6">
              <h2 className="font-display text-2xl font-semibold text-foreground">Создание аккаунта</h2>
              <p className="mt-1 text-sm text-muted-foreground">Присоединяйтесь и начинайте играть</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="reg-username" className="text-sm font-medium text-foreground/80">
                    Имя пользователя
                  </label>
                  <span className={`text-xs tabular-nums ${username.length > 20 ? "text-danger" : "text-muted-foreground"}`}
                        aria-live="polite">
                    {username.length}/24
                  </span>
                </div>
                <Input
                  id="reg-username"
                  placeholder="boardgamer123"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={24}
                  autoComplete="username"
                  hasError={!!error}
                />
                {username.length > 0 && username.length < 3 ? (
                  <p className="text-xs text-danger" role="alert">Минимум 3 символа</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reg-email" className="text-sm font-medium text-foreground/80">
                  Почта
                </label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  hasError={!!error}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reg-password" className="text-sm font-medium text-foreground/80">
                  Пароль
                </label>
                <Input
                  id="reg-password"
                  type="password"
                  placeholder="Минимум 8 символов"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  hasError={passwordWeak || !!error}
                />
                {passwordWeak ? (
                  <p className="text-xs text-danger" role="alert">Пароль слишком короткий (минимум 8 символов)</p>
                ) : null}
              </div>

              {error ? (
                <div className="notice-error" role="alert">{error}</div>
              ) : null}

              <Button type="submit" className="w-full" size="lg" isLoading={loading}>
                {loading ? "Создание..." : "Создать аккаунт"}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              Уже есть аккаунт?{" "}
              <Link to="/login" className="font-semibold text-primary hover:underline focus-visible:underline">
                Войти
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
