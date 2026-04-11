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
      <section className="animate-fade rounded-3xl border border-white/60 bg-gradient-to-br from-teal-600 via-cyan-600 to-blue-700 p-8 text-white shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/80">Сетевая Платформа</p>
        <h1 className="mt-4 font-display text-3xl font-bold leading-tight md:text-4xl">Настольные игры в реальном времени с комнатами и мгновенным реваншем</h1>
        <p className="mt-4 max-w-xl text-cyan-100">Играйте в шахматы, русские шашки и дурака онлайн: стабильные комнаты, переподключение и синхронизация состояния матча.</p>
        <div className="mt-6 grid gap-3 text-sm text-cyan-50 md:grid-cols-2">
          <div className="rounded-xl border border-white/30 bg-white/10 p-3">Быстрый вход по коду приглашения</div>
          <div className="rounded-xl border border-white/30 bg-white/10 p-3">Живой чат и статусы игроков</div>
          <div className="rounded-xl border border-white/30 bg-white/10 p-3">Управление кликом и перетягиванием</div>
          <div className="rounded-xl border border-white/30 bg-white/10 p-3">Устойчивая игра при переподключении</div>
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
            {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

            <div className="rounded-xl border border-cyan-100 bg-cyan-50/70 p-3 text-xs text-slate-700">
              <p className="mb-2 font-semibold">Тестовые учетные данные</p>
              <p>Пользователь: {demoUser.email} / {demoUser.password}</p>
              <p>Администратор: {demoAdmin.email} / {demoAdmin.password}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-2 text-xs"
                  onClick={() => {
                    setEmail(demoUser.email);
                    setPassword(demoUser.password);
                  }}
                >
                  Вставить пользователя
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-2 text-xs"
                  onClick={() => {
                    setEmail(demoAdmin.email);
                    setPassword(demoAdmin.password);
                  }}
                >
                  Вставить администратора
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Вход..." : "Войти"}
            </Button>
            <p className="text-sm text-slate-600">
              Нет аккаунта? <Link to="/register" className="font-semibold text-primary">Регистрация</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
