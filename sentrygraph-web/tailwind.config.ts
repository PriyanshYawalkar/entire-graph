import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      boxShadow: { glow: "0 0 32px rgba(56, 189, 248, 0.2)" },
    },
  },
  plugins: [],
} satisfies Config;
