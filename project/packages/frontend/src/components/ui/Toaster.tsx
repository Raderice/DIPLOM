import { useToastStore } from "../../store/toastStore";

const ICONS = { success: "✓", error: "✕", warn: "!", info: "i" };
const STYLES = {
  success: "border-green-500/40 bg-[#0e2318] text-green-400",
  error:   "border-[#e05555]/40 bg-[#2a1414] text-[#f87171]",
  warn:    "border-[#f2c94c]/40 bg-[#2a2310] text-[#f2c94c]",
  info:    "border-[#6aadff]/30 bg-[#0e1a2a] text-[#6aadff]",
};
const ICON_STYLES = {
  success: "bg-green-500/20 text-green-400",
  error:   "bg-red-500/20 text-red-400",
  warn:    "bg-yellow-500/20 text-yellow-400",
  info:    "bg-blue-500/20 text-blue-400",
};

export default function Toaster(): React.JSX.Element {
  const toasts  = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none"
      style={{ maxWidth: "min(380px, calc(100vw - 2rem))" }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            "pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-panel",
            "animate-slide-up text-sm font-medium",
            STYLES[t.type]
          ].join(" ")}
        >
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5 ${ICON_STYLES[t.type]}`}>
            {ICONS[t.type]}
          </span>
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="ml-1 shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity text-base leading-none"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
