import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { resolveApiBaseUrl } from "../lib/apiBaseUrl";

export default function JoinPage(): React.JSX.Element {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const API_URL = resolveApiBaseUrl();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const doJoin = async () => {
      if (!code) return navigate("/lobby");
      try {
        const res = await fetch(`${API_URL}/api/rooms/join-by-code`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteCode: code.toUpperCase() })
        });
        if (!res.ok) {
          setError("Комната не найдена или код недействителен.");
          setTimeout(() => navigate("/lobby"), 2000);
          return;
        }
        const data = await res.json();
        navigate(`/room/${(data as { roomId: string }).roomId}`);
      } catch {
        setError("Ошибка сети. Перенаправление в лобби...");
        setTimeout(() => navigate("/lobby"), 2000);
      }
    };
    void doJoin();
  }, [API_URL, code, navigate]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      {error ? (
        <>
          <p className="text-3xl">❌</p>
          <div>
            <p className="text-sm font-medium text-foreground">{error}</p>
            <p className="text-xs text-muted-foreground mt-1">Автоматическое перенаправление...</p>
          </div>
        </>
      ) : (
        <>
          <svg className="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-foreground">Подключение по приглашению...</p>
            <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest uppercase">{code}</p>
          </div>
        </>
      )}
    </div>
  );
}
