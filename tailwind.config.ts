import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#263238",
        leaf: "#3F7D58",
        linen: "#F8F5F0",
        rose: "#B86B77",
        surface: {
          app: "#F7F8F5",
          DEFAULT: "#FFFFFF",
          muted: "#F8F5F0",
          elevated: "#FFFFFF"
        },
        border: {
          subtle: "#E7E5E0",
          strong: "#C8C5BD"
        },
        text: {
          primary: "#263238",
          secondary: "#55615E",
          muted: "#707A77"
        },
        status: {
          info: "#2563EB",
          success: "#2F6F4E",
          warning: "#9A5B13",
          danger: "#B42318"
        },
        focus: "#256B45"
      },
      boxShadow: {
        soft: "0 12px 32px rgba(38, 50, 56, 0.08)",
        panel: "0 8px 24px rgba(38, 50, 56, 0.06)",
        dialog: "0 24px 64px rgba(38, 50, 56, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
