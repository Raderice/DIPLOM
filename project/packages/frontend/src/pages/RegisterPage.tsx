import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

export default function RegisterPage(): React.JSX.Element {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    const ok = await register(username, email, password);
    if (ok) {
      navigate("/lobby");
    }
  };

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-6 p-4 md:grid-cols-[1.1fr_0.9fr] md:p-8">
      <section className="animate-fade rounded-3xl border border-border bg-gradient-to-br from-[#1f2124] via-[#272a2f] to-[#2b2d30] p-8 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Создайте Профиль</p>
        <h1 className="mt-4 font-display text-3xl font-semibold leading-tight text-foreground md:text-4xl">
          Начните играть с друзьями в приватных комнатах в реальном времени
        </h1>
        <p className="mt-4 max-w-xl text-sm text-muted-foreground">
          Регистрация занимает меньше минуты. После входа вы сможете создавать комнаты, отправлять код друзьям и запускать игры мгновенно.
        </p>
        <div className="mt-6 space-y-3 text-sm text-foreground">
          <div className="rounded-xl border border-border bg-[#23262a] p-3">Безопасная авторизация на cookie-сессиях</div>
          <div className="rounded-xl border border-border bg-[#23262a] p-3">Создание комнат в один клик для шахмат, шашек и дурака</div>
          <div className="rounded-xl border border-border bg-[#23262a] p-3">Игра с компьютера и телефона</div>
        </div>
      </section>

      <Card className="w-full animate-rise">
        <CardHeader>
          <CardTitle>Создание аккаунта</CardTitle>
          <CardDescription>Присоединяйтесь и начинайте играть онлайн.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Имя пользователя" required />
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Почта" required />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              required
              minLength={8}
            />
            {error ? (
              <p className="rounded-lg border border-[#d35d5d]/40 bg-[#2c2020] p-2 text-sm text-[#d35d5d]">{error}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Создание..." : "Создать аккаунт"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Уже есть аккаунт? <Link to="/login" className="font-semibold text-[#f2c94c]">Войти</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
