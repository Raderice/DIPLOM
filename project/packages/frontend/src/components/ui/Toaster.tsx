import { useToastStore } from "../../store/toastStore";

const ICONS = { success: "✓", error: "✕", warn: "!", info: "i" };
const TYPE_CLASS: Record<string, string> = {
  success: "notice-success",
  error:   "notice-error",
  warn:    "notice-warn",
  info:    "notice-info",
};

export default function Toaster(): React.JSX.Element {
  const toasts  = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none"
      style={{ maxWidth: "min(380px, calc(100vw - 2rem))" }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={[
            "pointer-events-auto flex items-start gap-3 shadow-panel",
            t.exiting ? "animate-toast-out" : "animate-slide-up",
            TYPE_CLASS[t.type] ?? "notice-info"
          ].join(" ")}
        >
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold bg-current/15 mt-0.5"
            aria-hidden="true"
          >
            {ICONS[t.type]}
          </span>
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-current opacity-50 hover:opacity-100 hover:bg-current/10 transition-all -mr-1 -mt-0.5"
            aria-label="Закрыть уведомление"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
