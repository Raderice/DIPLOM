import { create } from "zustand";

type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

const saved = (localStorage.getItem("theme") as Theme | null) ?? "dark";
applyTheme(saved);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: saved,
  toggle: () =>
    set((s) => {
      const next: Theme = s.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      return { theme: next };
    }),
}));
