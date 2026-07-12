import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#263238",
        leaf: "#3F7D58",
        linen: "#F8F5F0",
        rose: "#B86B77"
      },
      boxShadow: {
        soft: "0 12px 32px rgba(38, 50, 56, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
