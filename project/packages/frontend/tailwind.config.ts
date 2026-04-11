import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(191 28% 78%)",
        input: "hsl(193 35% 92%)",
        ring: "hsl(176 93% 32%)",
        background: "hsl(190 43% 96%)",
        foreground: "hsl(213 39% 16%)",
        primary: {
          DEFAULT: "hsl(176 93% 32%)",
          foreground: "hsl(210 40% 98%)"
        },
        secondary: {
          DEFAULT: "hsl(200 94% 40%)",
          foreground: "hsl(210 40% 98%)"
        },
        muted: {
          DEFAULT: "hsl(188 26% 90%)",
          foreground: "hsl(204 18% 34%)"
        },
        card: {
          DEFAULT: "hsl(0 0% 100% / 0.86)",
          foreground: "hsl(213 39% 16%)"
        }
      },
      fontFamily: {
        sans: ["'Sora'", "'Segoe UI'", "sans-serif"],
        display: ["'Unbounded'", "'Sora'", "sans-serif"]
      },
      boxShadow: {
        panel: "0 22px 60px rgba(9, 38, 60, 0.14)",
        glow: "0 0 0 1px rgba(45, 212, 191, 0.25), 0 20px 50px rgba(6, 95, 70, 0.25)"
      }
    }
  },
  plugins: []
} satisfies Config;
