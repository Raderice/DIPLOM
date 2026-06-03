import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { resolveApiBaseUrl } from "../lib/apiBaseUrl";

export default function JoinPage(): React.JSX.Element {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const API_URL = resolveApiBaseUrl();

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
          navigate("/lobby");
          return;
        }
        const data = await res.json();
        navigate(`/room/${data.roomId}`);
      } catch {
        navigate("/lobby");
      }
    };
    void doJoin();
  }, [API_URL, code, navigate]);

  return <div className="p-6">Подключение по приглашению...</div>;
}
