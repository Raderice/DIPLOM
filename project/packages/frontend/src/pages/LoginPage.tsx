import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export default function LoginPage(): React.JSX.Element {
  const navigate   = useNavigate();
  const login      = useAuthStore((s) => s.login);
  const loading    = useAuthStore((s) => s.loading);
  const error      = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const ok = await login(email, password);
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
                Сетевая платформа
              </p>
              <h1 className="font-display text-3xl font-semibold leading-snug text-foreground sm:text-4xl">
                Настольные игры<br className="hidden sm:block" /> в реальном времени
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground max-w-[52ch]  mx-auto lg:mx-0">
                Шахматы, шашки, дурак, Alias и Мафия — всё в одном месте. Создавайте комнаты, приглашайте друзей и играйте мгновенно.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm max-w-md mx-auto lg:mx-0">
              {[
                { icon: "♟", label: "Шахматы с часами" },
                { icon: "⬤", label: "Русские шашки" },
                { icon: "♠", label: "Карточный дурак" },
                { icon: "💬", label: "Alias и Мафия" }
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
                  <span className="text-base" aria-hidden="true">{icon}</span>
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="animate-rise rounded-2xl border border-border bg-card p-6 shadow-panel sm:p-8">
            <div className="mb-6">
              <h2 className="font-display text-2xl font-semibold text-foreground">С возвращением</h2>
              <p className="mt-1 text-sm text-muted-foreground">Войдите, чтобы продолжить игру</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="text-sm font-medium text-foreground/80">
                  Почта
                </label>
                <Input
                  id="login-email"
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
                <label htmlFor="login-password" className="text-sm font-medium text-foreground/80">
                  Пароль
                </label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  hasError={!!error}
                />
              </div>

              {error ? (
                <div className="notice-error" role="alert">{error}</div>
              ) : null}

              <Button type="submit" className="w-full" size="lg" isLoading={loading}>
                {loading ? "Вход..." : "Войти"}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              Нет аккаунта?{" "}
              <Link to="/register" className="font-semibold text-primary hover:underline focus-visible:underline">
                Зарегистрироваться
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
