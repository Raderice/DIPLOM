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
      <section className="animate-fade rounded-3xl border border-white/60 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-8 text-white shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/80">Создайте Профиль</p>
        <h1 className="mt-4 font-display text-3xl font-bold leading-tight md:text-4xl">Начните играть с друзьями в приватных комнатах в реальном времени</h1>
        <p className="mt-4 max-w-xl text-cyan-100">Регистрация занимает меньше минуты. После входа вы сможете создавать комнаты, отправлять код друзьям и запускать игры мгновенно.</p>
        <div className="mt-6 space-y-3 text-sm text-cyan-50">
          <div className="rounded-xl border border-white/30 bg-white/10 p-3">Безопасная авторизация на cookie-сессиях</div>
          <div className="rounded-xl border border-white/30 bg-white/10 p-3">Создание комнат в один клик для шахмат, шашек и дурака</div>
          <div className="rounded-xl border border-white/30 bg-white/10 p-3">Игра с компьютера и телефона</div>
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
            {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Создание..." : "Создать аккаунт"}
            </Button>
            <p className="text-sm text-slate-600">
              Уже есть аккаунт? <Link to="/login" className="font-semibold text-primary">Войти</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
