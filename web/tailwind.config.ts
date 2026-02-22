import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        slateInk: "#0f172a",
        signal: "#0ea5a4",
        warning: "#f59e0b",
        danger: "#dc2626",
      },
      boxShadow: {
        glow: "0 10px 40px rgba(14,165,164,0.16)",
      },
    },
  },
  plugins: [],
};

export default config;
