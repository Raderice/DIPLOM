import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border:     "var(--color-border)",
        input:      "var(--color-input)",
        ring:       "var(--color-ring)",
        background: "var(--color-bg)",
        foreground: "var(--color-fg)",
        primary: {
          DEFAULT:    "var(--color-primary)",
          foreground: "var(--color-on-primary)"
        },
        secondary: {
          DEFAULT:    "var(--color-secondary)",
          foreground: "var(--color-on-secondary)"
        },
        muted: {
          DEFAULT:    "var(--color-muted)",
          foreground: "var(--color-muted-fg)"
        },
        card: {
          DEFAULT:    "var(--color-card)",
          foreground: "var(--color-card-fg)"
        },
        danger: {
          DEFAULT: "var(--color-danger)"
        }
      },
      fontFamily: {
        sans:    ["'Inter'", "'Segoe UI'", "system-ui", "sans-serif"],
        display: ["'Cinzel'", "'Georgia'", "serif"]
      },
      boxShadow: {
        panel: "0 4px 6px -1px rgba(0,0,0,0.4), 0 16px 40px -4px rgba(0,0,0,0.5)",
        glow:  "0 0 0 1px rgba(242,201,76,0.35), 0 8px 24px rgba(0,0,0,0.5)",
        "glow-sm": "0 0 0 1px rgba(242,201,76,0.25)",
        inner: "inset 0 1px 0 rgba(255,255,255,0.04)"
      },
      borderRadius: {
        "4xl": "2rem"
      },
      screens: {
        xs: "400px"
      }
    }
  },
  plugins: []
} satisfies Config;
