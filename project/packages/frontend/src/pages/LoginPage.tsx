import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

const demoUser = {
  email: import.meta.env.VITE_TEST_USER_EMAIL ?? "demo@example.com",
  password: import.meta.env.VITE_TEST_USER_PASSWORD ?? "DemoUser123!"
};

const demoAdmin = {
  email: import.meta.env.VITE_TEST_ADMIN_EMAIL ?? "admin@example.com",
  password: import.meta.env.VITE_TEST_ADMIN_PASSWORD ?? "AdminUser123!"
};

export default function LoginPage(): React.JSX.Element {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    const ok = await login(email, password);
    if (ok) {
      navigate("/lobby");
    }
  };

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-6 p-4 md:grid-cols-[1.1fr_0.9fr] md:p-8">
      <section className="animate-fade rounded-3xl border border-border bg-gradient-to-br from-[#1f2124] via-[#272a2f] to-[#2b2d30] p-8 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Сетевая Платформа</p>
        <h1 className="mt-4 font-display text-3xl font-semibold leading-tight text-foreground md:text-4xl">
          Настольные игры в реальном времени с комнатами и мгновенным реваншем
        </h1>
        <p className="mt-4 max-w-xl text-sm text-muted-foreground">
          Играйте в шахматы, русские шашки и дурака онлайн: стабильные комнаты, переподключение и синхронизация состояния матча.
        </p>
        <div className="mt-6 grid gap-3 text-sm text-foreground md:grid-cols-2">
          <div className="rounded-xl border border-border bg-[#23262a] p-3">Быстрый вход по коду приглашения</div>
          <div className="rounded-xl border border-border bg-[#23262a] p-3">Живой чат и статусы игроков</div>
          <div className="rounded-xl border border-border bg-[#23262a] p-3">Управление кликом и перетягиванием</div>
          <div className="rounded-xl border border-border bg-[#23262a] p-3">Устойчивая игра при переподключении</div>
        </div>
      </section>

      <Card className="w-full animate-rise">
        <CardHeader>
          <CardTitle>С возвращением</CardTitle>
          <CardDescription>Войдите в аккаунт, чтобы продолжить игру.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input type="email" placeholder="Почта" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error ? (
              <p className="rounded-lg border border-[#d35d5d]/40 bg-[#2c2020] p-2 text-sm text-[#d35d5d]">{error}</p>
            ) : null}

            {/* Test credentials removed for security. Use registration to create an account. */}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Вход..." : "Войти"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Нет аккаунта? <Link to="/register" className="font-semibold text-[#f2c94c]">Регистрация</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
