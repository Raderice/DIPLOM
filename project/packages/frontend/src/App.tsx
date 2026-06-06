import { Navigate, createBrowserRouter, RouterProvider, useRouteError } from "react-router-dom";
import { useEffect } from "react";

function RouteErrorPage() {
  const error = useRouteError();
  const isStackOverflow = error instanceof RangeError && String(error.message).includes("call stack");
  return (
    <div style={{ padding: 40, fontFamily: "sans-serif", textAlign: "center" }}>
      <h2>{isStackOverflow ? "Ошибка загрузки" : "Что-то пошло не так"}</h2>
      <p>
        {isStackOverflow
          ? "Расширение браузера мешает работе сайта. Отключите AdBlock / VPN расширение или откройте сайт в режиме инкогнито."
          : "Попробуйте обновить страницу."}
      </p>
      <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: "8px 24px", cursor: "pointer", fontSize: 16 }}>
        Обновить страницу
      </button>
    </div>
  );
}
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import LobbyPage from "./pages/LobbyPage";
import RoomPage from "./pages/RoomPage";
import JoinPage from "./pages/JoinPage";
import GamePage from "./pages/GamePage";
import AdminPage from "./pages/AdminPage";
import ProfilePage from "./pages/ProfilePage";
import Layout from "./components/Layout";
import { useAuthStore } from "./store/authStore";

function AppLoader(): React.JSX.Element {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <svg className="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
        <span className="text-sm">Загрузка...</span>
      </div>
    </div>
  );
}

function Protected({ children }: { children: React.JSX.Element }): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  if (!hydrated) return <AppLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminProtected({ children }: { children: React.JSX.Element }): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  if (!hydrated) return <AppLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/lobby" replace />;
  return children;
}

function GuestOnly({ children }: { children: React.JSX.Element }): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  if (!hydrated) return <AppLoader />;
  if (user) return <Navigate to="/lobby" replace />;
  return children;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: "/", element: <Navigate to="/lobby" replace /> },
      { path: "/login", element: <GuestOnly><LoginPage /></GuestOnly> },
      { path: "/register", element: <GuestOnly><RegisterPage /></GuestOnly> },
      { path: "/lobby", element: <Protected><LobbyPage /></Protected> },
      { path: "/room/:roomId", element: <Protected><RoomPage /></Protected> },
      { path: "/join/:code", element: <Protected><JoinPage /></Protected> },
      { path: "/game/:roomId", element: <Protected><GamePage /></Protected> },
      { path: "/admin", element: <AdminProtected><AdminPage /></AdminProtected> },
      { path: "/profile", element: <Protected><ProfilePage /></Protected> },
      { path: "/profile/:userId", element: <Protected><ProfilePage /></Protected> },
      { path: "*", element: <Navigate to="/lobby" replace /> }
    ]
  }
]);

export default function App(): React.JSX.Element {
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  return <RouterProvider router={router} />;
}
