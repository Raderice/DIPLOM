import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "var(--color-border)",
        input: "var(--color-input)",
        ring: "var(--color-ring)",
        background: "var(--color-bg)",
        foreground: "var(--color-fg)",
        primary: {
          DEFAULT: "var(--color-primary)",
          foreground: "var(--color-on-primary)"
        },
        secondary: {
          DEFAULT: "var(--color-secondary)",
          foreground: "var(--color-on-secondary)"
        },
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-muted-fg)"
        },
        card: {
          DEFAULT: "var(--color-card)",
          foreground: "var(--color-card-fg)"
        }
      },
      fontFamily: {
        sans: ["'Lato'", "'Segoe UI'", "sans-serif"],
        display: ["'Cinzel'", "'Lato'", "sans-serif"]
      },
      boxShadow: {
        panel: "0 18px 40px rgba(0, 0, 0, 0.45)",
        glow: "0 0 0 1px rgba(242, 201, 76, 0.35), 0 10px 30px rgba(0, 0, 0, 0.55)"
      }
    }
  },
  plugins: []
} satisfies Config;
