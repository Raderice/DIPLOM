import { Navigate, createBrowserRouter, RouterProvider } from "react-router-dom";
import { useEffect } from "react";
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

function Protected({ children }: { children: React.JSX.Element }): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  if (!hydrated) {
    return <div className="p-6">Загрузка...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AdminProtected({ children }: { children: React.JSX.Element }): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  if (!hydrated) return <div className="p-6">Загрузка...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/lobby" replace />;
  return children;
}

function GuestOnly({ children }: { children: React.JSX.Element }): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  if (!hydrated) return <div className="p-6">Загрузка...</div>;
  if (user) return <Navigate to="/lobby" replace />;
  return children;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
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
