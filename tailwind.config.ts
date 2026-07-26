import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Valli SPA AI palette (from mock-up)
        forest: {
          950: "#0a1f14",
          900: "#0d281a",
          800: "#123723",
          700: "#17452c",
          600: "#1d5637",
        },
        brand: {
          DEFAULT: "#22c55e",
          bright: "#4ade80",
          dark: "#16a34a",
          pale: "#dcfce7",
          mist: "#f0f7f2",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 3px rgba(13, 40, 26, 0.08), 0 1px 2px rgba(13, 40, 26, 0.04)",
        panel: "0 4px 24px rgba(13, 40, 26, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
